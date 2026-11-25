const CHUNK_SIZE = 15

function buildBatchedEslintCommands(filenames, fix = true) {
  const flag = fix ? 'eslint --fix' : 'eslint'
  const commands = []
  for (let i = 0; i < filenames.length; i += CHUNK_SIZE) {
    const batch = filenames.slice(i, i + CHUNK_SIZE).map((f) => `"${f}"`).join(' ')
    commands.push(`${flag} ${batch}`)
  }
  return commands
}

const lintStagedConfig = {
  '*.{ts,tsx}': (filenames) => buildBatchedEslintCommands(filenames, true),
  'eslint-rules/**/*.mjs': (filenames) => buildBatchedEslintCommands(filenames, false),
}

export default lintStagedConfig
