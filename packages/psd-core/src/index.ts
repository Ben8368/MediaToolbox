export { buildScanScript, parseScanOutput } from './scanner.js'
export type { ScanScriptOutput } from './scanner.js'

export { buildAlgorithmFunctions } from './algorithm.js'

export { buildApplyScript, parseApplyOutput } from './applier.js'
export type { ApplyScriptInput, ApplyScriptOutput } from './applier.js'

export { buildFontListScript, parseFontListOutput } from './fonts.js'
export type { FontListOutput } from './fonts.js'

export {
  compareRoundtripRecords,
  evaluatePsdRoundtripReport,
  FULL_ROUNDTRIP_THRESHOLDS,
  mirrorText,
  prepareRoundtripRecords,
  QUICK_ROUNDTRIP_THRESHOLDS,
  textLayerComparisonKey,
} from './roundtrip.js'
export type {
  PrepareRoundtripRecordsOptions,
  PsdRoundtripEvaluation,
  PsdRoundtripLayerDiff,
  PsdRoundtripMode,
  PsdRoundtripReport,
  PsdRoundtripThresholds,
} from './roundtrip.js'

export type PhotoshopScriptRunner = (script: string) => Promise<string>

export type PhotoshopCommandRunnerOptions = {
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export class PhotoshopPsdEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoshopPsdEngineError'
  }
}

export function createPhotoshopCommandRunner(options: PhotoshopCommandRunnerOptions): PhotoshopScriptRunner {
  return async (script: string) => {
    const [{ spawn }, fs, os, path] = await Promise.all([
      import('node:child_process'),
      import('node:fs/promises'),
      import('node:os'),
      import('node:path'),
    ])
    const tag = `${process.pid}-${Date.now()}`
    const scriptPath = path.join(os.tmpdir(), `mediatoolbox-ps-${tag}.jsx`)
    const outputPath = path.join(os.tmpdir(), `mediatoolbox-ps-${tag}.out`)

    // Photoshop $.writeln() on Windows goes to the ExtendScript console, not to
    // the process stdout.  Inject a file-write helper and redirect our marker
    // lines to the temp output file so we can read them back after execution.
    const outPathForJsx = outputPath.replace(/\\/g, '/')
    // ExtendScript (ES3) has no JSON built-in. Inject a minimal polyfill so that
    // JSON.stringify works in scanner, applier and font-list scripts.
    const jsonPolyfill = `
if(typeof JSON==="undefined"){JSON={
  stringify:function(v){return __mtbJS(v);},
  parse:function(s){return eval("("+s+")");}
};}
function __mtbJS(v){
  if(v===null)return"null";
  var t=typeof v;
  if(t==="boolean")return v?"true":"false";
  if(t==="number")return isFinite(v)?String(v):"null";
  if(t==="string"){
    var s='"';
    for(var i=0;i<v.length;i++){
      var c=v.charAt(i);
      if(c==='"')s+='\\\\"';
      else if(c==='\\\\')s+='\\\\\\\\';
      else if(c==='\\r')s+='\\\\r';
      else if(c==='\\n')s+='\\\\n';
      else if(c==='\\t')s+='\\\\t';
      else if(c==='\\b')s+='\\\\b';
      else if(c==='\\f')s+='\\\\f';
      else s+=c;
    }
    return s+'"';
  }
  if(t==="object"){
    if(v instanceof Array){
      var a=[];for(var i=0;i<v.length;i++)a.push(__mtbJS(v[i]));
      return"["+a.join(",")+"]";
    }
    var o=[];
    for(var k in v){if(v.hasOwnProperty(k))o.push(__mtbJS(k)+":"+__mtbJS(v[k]));}
    return"{"+o.join(",")+"}";
  }
  return"undefined";
}`.trim()
    const fileWriterPreamble = [
      jsonPolyfill,
      `var __MTB_OUT=new File(${JSON.stringify(outPathForJsx)});`,
      `function __mtbOut(s){try{__MTB_OUT.encoding="UTF-8";__MTB_OUT.open("a");__MTB_OUT.write(s);__MTB_OUT.close();}catch(e){throw new Error("Failed to write output: "+e);}}`,
    ].join('\n')
    const transformedScript = fileWriterPreamble + '\n' +
      script.replace(/\$\.writeln\(/g, '__mtbOut(')

    await fs.writeFile(scriptPath, transformedScript, 'utf8')

    try {
      if (process.platform === 'win32') {
        // On Windows, Photoshop.exe is a single-instance GUI app — spawning it
        // directly with a .jsx arg does not reliably execute the script.
        // Use VBScript COM automation instead: DoJavaScriptFile() blocks until
        // the script finishes, so cscript.exe exits only after PS is done.
        await runViaWindowsCom(scriptPath, outputPath, tag, options, spawn, fs, os, path)
      } else {
        await runViaDirectSpawn(scriptPath, options, spawn)
      }

      const output = await fs.readFile(outputPath, 'utf8').catch(() => '')
      if (!output.includes('__MTB_JSON__')) {
        throw new PhotoshopPsdEngineError(
          'Photoshop executed the script but produced no output. ' +
          'Check that the PSD file exists and Photoshop can process it.',
        )
      }
      return output
    } finally {
      await fs.unlink(scriptPath).catch(() => undefined)
      await fs.unlink(outputPath).catch(() => undefined)
    }
  }
}

type SpawnFn = typeof import('node:child_process')['spawn']
type FsPromises = typeof import('node:fs/promises')
type OsMod = typeof import('node:os')
type PathMod = typeof import('node:path')

async function runViaWindowsCom(
  scriptPath: string,
  outputPath: string,
  tag: string,
  options: PhotoshopCommandRunnerOptions,
  spawn: SpawnFn,
  fs: FsPromises,
  os: OsMod,
  path: PathMod,
): Promise<void> {
  // Use PowerShell instead of VBScript: PowerShell reads UTF-8 files correctly
  // (FileSystemObject in VBScript defaults to ANSI/GBK on Chinese Windows).
  // DoJavaScript(code) runs synchronously — powershell.exe exits when PS finishes.
  const ps1Path = path.join(os.tmpdir(), `mediatoolbox-ps-${tag}.ps1`)
  // Single-quoted PS string: backslashes are literal, no JSON double-escape needed.
  const jsxPathPs = scriptPath.replace(/'/g, "''")
  const ps1 = [
    `$ErrorActionPreference = 'Stop'`,
    `try {`,
    `  $psApp = New-Object -ComObject 'Photoshop.Application'`,
    `  $code = [System.IO.File]::ReadAllText('${jsxPathPs}', [System.Text.Encoding]::UTF8)`,
    `  $psApp.DoJavaScript($code)`,
    `} catch {`,
    `  Write-Error "PS COM error: $_"`,
    `  exit 1`,
    `}`,
  ].join('\r\n')
  await fs.writeFile(ps1Path, ps1, 'utf8')

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1Path],
        { env: { ...process.env, ...options.env }, windowsHide: true },
      )
      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      child.on('error', reject)
      child.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new PhotoshopPsdEngineError(
            `Photoshop COM automation failed (exit ${code})${stderr ? ': ' + stderr.trim() : ''}. ` +
            `Ensure Photoshop is running and accessible.`,
          ))
        }
      })
    })
  } finally {
    await fs.unlink(ps1Path).catch(() => undefined)
  }
}

async function runViaDirectSpawn(
  scriptPath: string,
  options: PhotoshopCommandRunnerOptions,
  spawn: SpawnFn,
): Promise<void> {
  const args = options.args !== undefined && options.args.length > 0
    ? options.args.map((arg) => (arg === '{script}' ? scriptPath : arg))
    : [scriptPath]
  return new Promise<void>((resolve, reject) => {
    const child = spawn(options.command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      windowsHide: true,
    })
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === null) {
        reject(new PhotoshopPsdEngineError('Photoshop process was killed'))
      } else if (code !== 0 && stderr.trim()) {
        // Non-zero exit with stderr content — include it for diagnostics
        reject(new PhotoshopPsdEngineError(
          `Photoshop command exited with code ${code}: ${stderr.trim()}`
        ))
      } else {
        // Don't fail on non-zero without stderr: PS may emit locale warnings but still succeed.
        // Success is determined by reading the output file.
        resolve()
      }
    })
  })
}
