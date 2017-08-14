import babel from 'rollup-plugin-babel'

export default {
  entry: 'public.src/main.js',
  dest: 'public/main.js',
  moduleName: 'cojs',
  plugins: [
    babel({
      exclude: 'node_modules/**'
    })
  ],
  format: 'iife'
}
