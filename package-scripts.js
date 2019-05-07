/**
 * Created by istrauss on 5/9/2017.
 */

const {series, crossEnv, copy, rimraf} = require('nps-utils');

module.exports = {
    scripts: {
        default: 'nps transpile',
        transpile: series(
            rimraf('dist'),
            'babel ./src -d dist'
        )
    }
};
