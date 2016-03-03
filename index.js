/**
 * @file index
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project pomegranate-express-route-directory
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';
var _ = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');

/**
 * Loads and mounts provided route definition files located in options.workDir
 * @module Router
 * @injector {None} Adds nothing to the injector.
 * @property {Object} options Plugin Options
 * @property {String} options.workDir=./routes - Directory to load routes from.
 */

module.exports = {
  options: {
    workDir: './routes'
  },
  metadata: {
    name: 'Router',
    layer: 'router',
    type: 'none'
  },
  plugin: {
    load: function(inject, loaded) {
      var self = this;
      var loadCount = 0;
      inject(function(Express){

        var loadIfFile = function(filePath){
          return fs.readdirAsync(filePath)
            .map(function(fileName){
              var pendingIncludePath = path.join(filePath, fileName);
              var notHidden = fileName.indexOf('.') !== 0;

              return fs.statAsync(pendingIncludePath)
                .then(function(stats){
                  if(stats.isDirectory()){
                    return loadIfFile(pendingIncludePath)
                  }
                  else if(notHidden) {
                    return pendingIncludePath
                  }
                  else {
                    return false
                  }
                })
            })
            .filter(function(filepath){
              return filepath
            })
            .reduce(function(a, b){
              return a.concat(b)
            }, [])
        };

        var checkIndexName = function(name){
          return (name === 'index' || name === 'base' || name === 'main' || name === 'root');
        };

        var parseMountPath = function(basePath, includePath) {
          var resolved = path.parse(path.relative(basePath, includePath));
          // TODO: This needs another check to allow not index routes to be mounted directly in the
          // base path.
          if(resolved.dir === ''){
            if(!checkIndexName(resolved.name)){
              self.Logger.warn('RouteLoader: Non default name used for base route file.');
            }
            return '/'
          }
          if(checkIndexName(resolved.name)){
            return ('/' + resolved.dir).toLowerCase()
          }
          return ('/' + resolved.dir + '/' + resolved.name).toLowerCase();
        };

        loadIfFile(self.options.workDir)
          .each(function(pendingRequirePath){
            var mountPath = parseMountPath(self.options.workDir, pendingRequirePath);
            var route = require(pendingRequirePath);
            route = inject(route);
            if(_.isObject(route) && route.name === 'router'){
              loadCount += 1;
              self.Logger.log('Loaded routes for ' + mountPath);
              Express.use(mountPath, route)
            } else {
              self.Logger.error('Express Router: Attempted to load invalid route module:'
                + '\n'
                + path.relative(self.options.routes, pendingRequirePath)
                + '\n'
                + 'Route modules must return a Router Object.')
            }
            return pendingRequirePath
          })
          .then(function(d){
            loaded(null, null)
          }).catch(function(err){
            loaded(err, null)
          })

      })

    },
    start: function(done) {
      done()
    },
    stop: function(done) {
      done()
    }
  }
};