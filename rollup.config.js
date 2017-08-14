import babel from 'rollup-plugin-babel'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'


export default {
  entry: 'public.src/main.js',
  dest: 'public/main.js',
  moduleName: 'cojs',
  plugins: [
    resolve(),
    commonjs(),
    babel({
      exclude: 'node_modules/**'
    })
  ],
  format: 'iife'
}
