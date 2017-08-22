import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import svelte from 'rollup-plugin-svelte'


export default {
  entry: 'public.src/main.js',
  dest: 'public/main.js',
  moduleName: 'cojs',
  plugins: [
    resolve({browser: true}),
    commonjs(),
    svelte(),
    babel({
      exclude: 'node_modules/**'
    })
  ],
  format: 'iife',
  globals: {
    'esprima': 'esprima'
  }
}
