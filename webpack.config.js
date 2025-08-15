const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './blucap.js',
    output: {
      filename: isProduction ? 'blucap.min.js' : 'blucap.bundle.js',
      path: path.resolve(__dirname, 'dist'),
      library: {
        name: 'Blucap',
        type: 'umd'
      },
      globalObject: 'this',
      clean: true
    },
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    externals: {
      // 将 axios 作为外部依赖，用户需要自己引入
      'axios': {
        commonjs: 'axios',
        commonjs2: 'axios',
        amd: 'axios',
        root: 'axios'
      }
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  '@babel/preset-env',
                  {
                    targets: {
                      browsers: ['> 1%', 'last 2 versions', 'not ie <= 8']
                    },
                    modules: false
                  }
                ]
              ]
            }
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js']
    },
    optimization: {
      minimize: isProduction
    }
  };
};