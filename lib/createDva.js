'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.default = createDva;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactRedux = require('react-redux');

var _redux = require('redux');

var _middleware = require('redux-saga/lib/internal/middleware');

var _middleware2 = _interopRequireDefault(_middleware);

var _effects = require('redux-saga/effects');

var sagaEffects = _interopRequireWildcard(_effects);

var _isPlainObject = require('is-plain-object');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _flatten = require('flatten');

var _flatten2 = _interopRequireDefault(_flatten);

var _window = require('global/window');

var _window2 = _interopRequireDefault(_window);

var _document = require('global/document');

var _document2 = _interopRequireDefault(_document);

var _sagaHelpers = require('redux-saga/lib/internal/sagaHelpers');

var _lodash = require('lodash.isfunction');

var _lodash2 = _interopRequireDefault(_lodash);

var _handleActions = require('./handleActions');

var _handleActions2 = _interopRequireDefault(_handleActions);

var _plugin = require('./plugin');

var _plugin2 = _interopRequireDefault(_plugin);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SEP = '/';

function createDva(createOpts) {
  var mobile = createOpts.mobile,
      initialReducer = createOpts.initialReducer,
      defaultHistory = createOpts.defaultHistory,
      routerMiddleware = createOpts.routerMiddleware,
      setupHistory = createOpts.setupHistory;

  /**
   * Create a dva instance.
   */

  return function dva() {
    var hooks = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    // history and initialState does not pass to plugin
    var history = hooks.history || defaultHistory;
    var initialState = hooks.initialState || {};
    delete hooks.history;
    delete hooks.initialState;

    var plugin = new _plugin2.default();
    plugin.use(hooks);

    var app = {
      // properties
      _models: [],
      _router: null,
      _store: null,
      _history: null,
      _plugin: plugin,
      _getProvider: null,
      // methods
      use: use,
      model: model,
      router: router,
      start: start
    };
    return app;

    // //////////////////////////////////
    // Methods

    /**
     * Register an object of hooks on the application.
     *
     * @param hooks
     */
    function use(hooks) {
      plugin.use(hooks);
    }

    /**
     * Register a model.
     *
     * @param model
     */
    function model(model) {
      this._models.push(checkModel(model, mobile));
    }

    // inject model dynamically
    function injectModel(createReducer, onError, unlisteners, m) {
      m = checkModel(m, mobile);
      this._models.push(m);
      var store = this._store;

      // reducers
      store.asyncReducers[m.namespace] = getReducer(m.reducers, m.state);
      store.replaceReducer(createReducer(store.asyncReducers));
      // effects
      if (m.effects) {
        store.runSaga(getSaga(m.effects, m, onError));
      }
      // subscriptions
      if (m.subscriptions) {
        unlisteners[m.namespace] = runSubscriptions(m.subscriptions, m, this, onError);
      }
    }

    // Unexpected key warn problem:
    // https://github.com/reactjs/redux/issues/1636
    function unmodel(createReducer, reducers, _unlisteners, namespace) {
      var store = this._store;

      // Delete reducers
      delete store.asyncReducers[namespace];
      delete reducers[namespace];
      store.replaceReducer(createReducer(store.asyncReducers));
      store.dispatch({ type: '@@dva/UPDATE' });

      // Cancel effects
      store.dispatch({ type: namespace + '/@@CANCEL_EFFECTS' });

      // unlisten subscrioptions
      if (_unlisteners[namespace]) {
        var _unlisteners$namespac = _unlisteners[namespace],
            unlisteners = _unlisteners$namespac.unlisteners,
            noneFunctionSubscriptions = _unlisteners$namespac.noneFunctionSubscriptions;

        (0, _warning2.default)(noneFunctionSubscriptions.length === 0, 'app.unmodel: subscription should return unlistener function, check these subscriptions ' + noneFunctionSubscriptions.join(', '));
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = (0, _getIterator3.default)(unlisteners), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var unlistener = _step.value;

            unlistener();
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        delete _unlisteners[namespace];
      }

      // delete model from this._models
      this._models = this._models.filter(function (model) {
        return model.namespace !== namespace;
      });
    }

    /**
     * Config router. Takes a function with arguments { history, dispatch },
     * and expects router config. It use the same api as react-router,
     * return jsx elements or JavaScript Object for dynamic routing.
     *
     * @param router
     */
    function router(router) {
      (0, _invariant2.default)(typeof router === 'function', 'app.router: router should be function');
      this._router = router;
    }

    /**
     * Start the application. Selector is optional. If no selector
     * arguments, it will return a function that return JSX elements.
     *
     * @param container selector | HTMLElement
     */
    function start(container) {
      // support selector
      if (typeof container === 'string') {
        container = _document2.default.querySelector(container);
        (0, _invariant2.default)(container, 'app.start: could not query selector: ' + container);
      }

      (0, _invariant2.default)(!container || isHTMLElement(container), 'app.start: container should be HTMLElement');
      (0, _invariant2.default)(this._router, 'app.start: router should be defined');

      // error wrapper
      var onError = plugin.apply('onError', function (err) {
        throw new Error(err.stack || err);
      });
      var onErrorWrapper = function onErrorWrapper(err) {
        if (err) {
          if (typeof err === 'string') err = new Error(err);
          onError(err, app._store.dispatch);
        }
      };

      // internal model for destroy
      model.call(this, {
        namespace: '@@dva',
        state: 0,
        reducers: {
          UPDATE: function UPDATE(state) {
            return state + 1;
          }
        }
      });

      // get reducers and sagas from model
      var sagas = [];
      var reducers = (0, _extends3.default)({}, initialReducer);
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = (0, _getIterator3.default)(this._models), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var m = _step2.value;

          reducers[m.namespace] = getReducer(m.reducers, m.state);
          if (m.effects) sagas.push(getSaga(m.effects, m, onErrorWrapper));
        }

        // extra reducers
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      var extraReducers = plugin.get('extraReducers');
      (0, _invariant2.default)((0, _keys2.default)(extraReducers).every(function (key) {
        return !(key in reducers);
      }), 'app.start: extraReducers is conflict with other reducers');

      // extra enhancers
      var extraEnhancers = plugin.get('extraEnhancers');
      (0, _invariant2.default)(Array.isArray(extraEnhancers), 'app.start: extraEnhancers should be array');

      // create store
      var extraMiddlewares = plugin.get('onAction');
      var reducerEnhancer = plugin.get('onReducer');
      var sagaMiddleware = (0, _middleware2.default)();
      var middlewares = [sagaMiddleware].concat((0, _toConsumableArray3.default)((0, _flatten2.default)(extraMiddlewares)));
      if (routerMiddleware) {
        middlewares = [routerMiddleware(history)].concat((0, _toConsumableArray3.default)(middlewares));
      }
      var devtools = function devtools() {
        return function (noop) {
          return noop;
        };
      };
      if (process.env.NODE_ENV !== 'production' && _window2.default.__REDUX_DEVTOOLS_EXTENSION__) {
        devtools = _window2.default.__REDUX_DEVTOOLS_EXTENSION__;
      }
      var enhancers = [_redux.applyMiddleware.apply(undefined, (0, _toConsumableArray3.default)(middlewares)), devtools()].concat((0, _toConsumableArray3.default)(extraEnhancers));
      var store = this._store = (0, _redux.createStore)( // eslint-disable-line
      createReducer(), initialState, _redux.compose.apply(undefined, (0, _toConsumableArray3.default)(enhancers)));

      function createReducer(asyncReducers) {
        return reducerEnhancer((0, _redux.combineReducers)((0, _extends3.default)({}, reducers, extraReducers, asyncReducers)));
      }

      // extend store
      store.runSaga = sagaMiddleware.run;
      store.asyncReducers = {};

      // store change
      var listeners = plugin.get('onStateChange');
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        var _loop = function _loop() {
          var listener = _step3.value;

          store.subscribe(function () {
            listener(store.getState());
          });
        };

        for (var _iterator3 = (0, _getIterator3.default)(listeners), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          _loop();
        }

        // start saga
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      sagas.forEach(sagaMiddleware.run);

      // setup history
      if (setupHistory) setupHistory.call(this, history);

      // run subscriptions
      var unlisteners = {};
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = (0, _getIterator3.default)(this._models), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var _model = _step4.value;

          if (_model.subscriptions) {
            unlisteners[_model.namespace] = runSubscriptions(_model.subscriptions, _model, this, onErrorWrapper);
          }
        }

        // inject model after start
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }

      this.model = injectModel.bind(this, createReducer, onErrorWrapper, unlisteners);

      this.unmodel = unmodel.bind(this, createReducer, reducers, unlisteners);

      // export _getProvider for HMR
      // ref: https://github.com/dvajs/dva/issues/469
      this._getProvider = getProvider.bind(null, app._store, app);

      // If has container, render; else, return react component
      if (container) {
        render(container, store, this, this._router);
        plugin.apply('onHmr')(render.bind(this, container, store, this));
      } else {
        return getProvider(store, this, this._router);
      }
    }

    // //////////////////////////////////
    // Helpers

    function getProvider(store, app, router) {
      return function (extraProps) {
        return _react2.default.createElement(
          _reactRedux.Provider,
          { store: store },
          router((0, _extends3.default)({ app: app, history: app._history }, extraProps))
        );
      };
    }

    function render(container, store, app, router) {
      var ReactDOM = require('react-dom');
      ReactDOM.render(_react2.default.createElement(getProvider(store, app, router)), container);
    }

    function checkModel(m, mobile) {
      // Clone model to avoid prefixing namespace multiple times
      var model = (0, _extends3.default)({}, m);
      var namespace = model.namespace,
          reducers = model.reducers,
          effects = model.effects;


      (0, _invariant2.default)(namespace, 'app.model: namespace should be defined');
      (0, _invariant2.default)(!app._models.some(function (model) {
        return model.namespace === namespace;
      }), 'app.model: namespace should be unique');
      (0, _invariant2.default)(mobile || namespace !== 'routing', 'app.model: namespace should not be routing, it\'s used by react-redux-router');
      (0, _invariant2.default)(!model.subscriptions || (0, _isPlainObject2.default)(model.subscriptions), 'app.model: subscriptions should be Object');
      (0, _invariant2.default)(!reducers || (0, _isPlainObject2.default)(reducers) || Array.isArray(reducers), 'app.model: reducers should be Object or array');
      (0, _invariant2.default)(!Array.isArray(reducers) || (0, _isPlainObject2.default)(reducers[0]) && typeof reducers[1] === 'function', 'app.model: reducers with array should be app.model({ reducers: [object, function] })');
      (0, _invariant2.default)(!effects || (0, _isPlainObject2.default)(effects), 'app.model: effects should be Object');

      function applyNamespace(type) {
        function getNamespacedReducers(reducers) {
          return (0, _keys2.default)(reducers).reduce(function (memo, key) {
            (0, _warning2.default)(key.indexOf('' + namespace + SEP) !== 0, 'app.model: ' + type.slice(0, -1) + ' ' + key + ' should not be prefixed with namespace ' + namespace);
            memo['' + namespace + SEP + key] = reducers[key];
            return memo;
          }, {});
        }

        if (model[type]) {
          if (type === 'reducers' && Array.isArray(model[type])) {
            model[type][0] = getNamespacedReducers(model[type][0]);
          } else {
            model[type] = getNamespacedReducers(model[type]);
          }
        }
      }

      applyNamespace('reducers');
      applyNamespace('effects');

      return model;
    }

    function isHTMLElement(node) {
      return (typeof node === 'undefined' ? 'undefined' : (0, _typeof3.default)(node)) === 'object' && node !== null && node.nodeType && node.nodeName;
    }

    function getReducer(reducers, state) {
      // Support reducer enhancer
      // e.g. reducers: [realReducers, enhancer]
      if (Array.isArray(reducers)) {
        return reducers[1]((0, _handleActions2.default)(reducers[0], state));
      } else {
        return (0, _handleActions2.default)(reducers || {}, state);
      }
    }

    function getSaga(effects, model, onError) {
      return _regenerator2.default.mark(function _callee3() {
        var _this = this;

        var key;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.t0 = _regenerator2.default.keys(effects);

              case 1:
                if ((_context3.t1 = _context3.t0()).done) {
                  _context3.next = 7;
                  break;
                }

                key = _context3.t1.value;

                if (!Object.prototype.hasOwnProperty.call(effects, key)) {
                  _context3.next = 5;
                  break;
                }

                return _context3.delegateYield(_regenerator2.default.mark(function _callee2() {
                  var watcher, task;
                  return _regenerator2.default.wrap(function _callee2$(_context2) {
                    while (1) {
                      switch (_context2.prev = _context2.next) {
                        case 0:
                          watcher = getWatcher(key, effects[key], model, onError);
                          _context2.next = 3;
                          return sagaEffects.fork(watcher);

                        case 3:
                          task = _context2.sent;
                          _context2.next = 6;
                          return sagaEffects.fork(_regenerator2.default.mark(function _callee() {
                            return _regenerator2.default.wrap(function _callee$(_context) {
                              while (1) {
                                switch (_context.prev = _context.next) {
                                  case 0:
                                    _context.next = 2;
                                    return sagaEffects.take(model.namespace + '/@@CANCEL_EFFECTS');

                                  case 2:
                                    _context.next = 4;
                                    return sagaEffects.cancel(task);

                                  case 4:
                                  case 'end':
                                    return _context.stop();
                                }
                              }
                            }, _callee, this);
                          }));

                        case 6:
                        case 'end':
                          return _context2.stop();
                      }
                    }
                  }, _callee2, _this);
                })(), 't2', 5);

              case 5:
                _context3.next = 1;
                break;

              case 7:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      });
    }

    function getWatcher(key, _effect, model, onError) {
      var _marked = [sagaWithCatch].map(_regenerator2.default.mark);

      var effect = _effect;
      var type = 'takeEvery';
      var ms = void 0;

      if (Array.isArray(_effect)) {
        effect = _effect[0];
        var opts = _effect[1];
        if (opts && opts.type) {
          type = opts.type;
          if (type === 'throttle') {
            (0, _invariant2.default)(opts.ms, 'app.start: opts.ms should be defined if type is throttle');
            ms = opts.ms;
          }
        }
        (0, _invariant2.default)(['watcher', 'takeEvery', 'takeLatest', 'throttle'].indexOf(type) > -1, 'app.start: effect type should be takeEvery, takeLatest, throttle or watcher');
      }

      function sagaWithCatch() {
        var _len,
            args,
            _key,
            _args4 = arguments;

        return _regenerator2.default.wrap(function sagaWithCatch$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.prev = 0;

                for (_len = _args4.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                  args[_key] = _args4[_key];
                }

                _context4.next = 4;
                return effect.apply(undefined, (0, _toConsumableArray3.default)(args.concat(createEffects(model))));

              case 4:
                _context4.next = 9;
                break;

              case 6:
                _context4.prev = 6;
                _context4.t0 = _context4['catch'](0);

                onError(_context4.t0);

              case 9:
              case 'end':
                return _context4.stop();
            }
          }
        }, _marked[0], this, [[0, 6]]);
      }

      var onEffect = plugin.get('onEffect');
      var sagaWithOnEffect = applyOnEffect(onEffect, sagaWithCatch, model, key);

      switch (type) {
        case 'watcher':
          return sagaWithCatch;
        case 'takeLatest':
          return _regenerator2.default.mark(function _callee4() {
            return _regenerator2.default.wrap(function _callee4$(_context5) {
              while (1) {
                switch (_context5.prev = _context5.next) {
                  case 0:
                    _context5.next = 2;
                    return (0, _sagaHelpers.takeLatestHelper)(key, sagaWithOnEffect);

                  case 2:
                  case 'end':
                    return _context5.stop();
                }
              }
            }, _callee4, this);
          });
        case 'throttle':
          return _regenerator2.default.mark(function _callee5() {
            return _regenerator2.default.wrap(function _callee5$(_context6) {
              while (1) {
                switch (_context6.prev = _context6.next) {
                  case 0:
                    _context6.next = 2;
                    return (0, _sagaHelpers.throttleHelper)(ms, key, sagaWithOnEffect);

                  case 2:
                  case 'end':
                    return _context6.stop();
                }
              }
            }, _callee5, this);
          });
        default:
          return _regenerator2.default.mark(function _callee6() {
            return _regenerator2.default.wrap(function _callee6$(_context7) {
              while (1) {
                switch (_context7.prev = _context7.next) {
                  case 0:
                    _context7.next = 2;
                    return (0, _sagaHelpers.takeEveryHelper)(key, sagaWithOnEffect);

                  case 2:
                  case 'end':
                    return _context7.stop();
                }
              }
            }, _callee6, this);
          });
      }
    }

    function runSubscriptions(subs, model, app, onError) {
      var unlisteners = [];
      var noneFunctionSubscriptions = [];
      for (var key in subs) {
        if (Object.prototype.hasOwnProperty.call(subs, key)) {
          var sub = subs[key];
          (0, _invariant2.default)(typeof sub === 'function', 'app.start: subscription should be function');
          var unlistener = sub({
            dispatch: createDispatch(app._store.dispatch, model),
            history: app._history
          }, onError);
          if ((0, _lodash2.default)(unlistener)) {
            unlisteners.push(unlistener);
          } else {
            noneFunctionSubscriptions.push(key);
          }
        }
      }
      return { unlisteners: unlisteners, noneFunctionSubscriptions: noneFunctionSubscriptions };
    }

    function prefixType(type, model) {
      var prefixedType = '' + model.namespace + SEP + type;
      if (model.reducers && model.reducers[prefixedType] || model.effects && model.effects[prefixedType]) {
        return prefixedType;
      }
      return type;
    }

    function createEffects(model) {
      function checkActionType(type) {
        (0, _invariant2.default)(type, 'dispatch: action should be a plain Object with type');
        (0, _warning2.default)(type.indexOf('' + model.namespace + SEP) !== 0, 'effects.put: ' + type + ' should not be prefixed with namespace ' + model.namespace);
      }
      function put(action) {
        var type = action.type;

        checkActionType(type);
        return sagaEffects.put((0, _extends3.default)({}, action, { type: prefixType(type, model) }));
      }
      put.resolve = function (action) {
        var type = action.type;

        checkActionType(type);
        return sagaEffects.put.resolve((0, _extends3.default)({}, action, { type: prefixType(type, model) }));
      };
      return (0, _extends3.default)({}, sagaEffects, { put: put });
    }

    function createDispatch(dispatch, model) {
      return function (action) {
        var type = action.type;

        (0, _invariant2.default)(type, 'dispatch: action should be a plain Object with type');
        (0, _warning2.default)(type.indexOf('' + model.namespace + SEP) !== 0, 'dispatch: ' + type + ' should not be prefixed with namespace ' + model.namespace);
        return dispatch((0, _extends3.default)({}, action, { type: prefixType(type, model) }));
      };
    }

    function applyOnEffect(fns, effect, model, key) {
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = (0, _getIterator3.default)(fns), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var fn = _step5.value;

          effect = fn(effect, sagaEffects, model, key);
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5.return) {
            _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }

      return effect;
    }
  };
}
module.exports = exports['default'];