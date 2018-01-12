/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var _run = __webpack_require__(2);
	
	var _dom = __webpack_require__(9);
	
	var _clearInput = __webpack_require__(104);
	
	var _ipfsPubsubRoom = __webpack_require__(105);
	
	var _app = __webpack_require__(155);
	
	var main = _app.App;
	
	var drivers = {
	  DOM: (0, _dom.makeDOMDriver)('#app'),
	  ClearInput: (0, _clearInput.makeClearInputDriver)(),
	  Room: (0, _ipfsPubsubRoom.makeIPFSRoomDriver)('TestRoom123')
	};
	
	(0, _run.run)(main, drivers);

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var xstream_1 = __webpack_require__(3);
	var adapt_1 = __webpack_require__(8);
	function logToConsoleError(err) {
	    var target = err.stack || err;
	    if (console && console.error) {
	        console.error(target);
	    }
	    else if (console && console.log) {
	        console.log(target);
	    }
	}
	function makeSinkProxies(drivers) {
	    var sinkProxies = {};
	    for (var name_1 in drivers) {
	        if (drivers.hasOwnProperty(name_1)) {
	            sinkProxies[name_1] = xstream_1.default.createWithMemory();
	        }
	    }
	    return sinkProxies;
	}
	function callDrivers(drivers, sinkProxies) {
	    var sources = {};
	    for (var name_2 in drivers) {
	        if (drivers.hasOwnProperty(name_2)) {
	            sources[name_2] = drivers[name_2](sinkProxies[name_2], name_2);
	            if (sources[name_2] && typeof sources[name_2] === 'object') {
	                sources[name_2]._isCycleSource = name_2;
	            }
	        }
	    }
	    return sources;
	}
	// NOTE: this will mutate `sources`.
	function adaptSources(sources) {
	    for (var name_3 in sources) {
	        if (sources.hasOwnProperty(name_3) &&
	            sources[name_3] &&
	            typeof sources[name_3]['shamefullySendNext'] === 'function') {
	            sources[name_3] = adapt_1.adapt(sources[name_3]);
	        }
	    }
	    return sources;
	}
	function replicateMany(sinks, sinkProxies) {
	    var sinkNames = Object.keys(sinks).filter(function (name) { return !!sinkProxies[name]; });
	    var buffers = {};
	    var replicators = {};
	    sinkNames.forEach(function (name) {
	        buffers[name] = { _n: [], _e: [] };
	        replicators[name] = {
	            next: function (x) { return buffers[name]._n.push(x); },
	            error: function (err) { return buffers[name]._e.push(err); },
	            complete: function () { },
	        };
	    });
	    var subscriptions = sinkNames.map(function (name) {
	        return xstream_1.default.fromObservable(sinks[name]).subscribe(replicators[name]);
	    });
	    sinkNames.forEach(function (name) {
	        var listener = sinkProxies[name];
	        var next = function (x) {
	            listener._n(x);
	        };
	        var error = function (err) {
	            logToConsoleError(err);
	            listener._e(err);
	        };
	        buffers[name]._n.forEach(next);
	        buffers[name]._e.forEach(error);
	        replicators[name].next = next;
	        replicators[name].error = error;
	        // because sink.subscribe(replicator) had mutated replicator to add
	        // _n, _e, _c, we must also update these:
	        replicators[name]._n = next;
	        replicators[name]._e = error;
	    });
	    buffers = null; // free up for GC
	    return function disposeReplication() {
	        subscriptions.forEach(function (s) { return s.unsubscribe(); });
	        sinkNames.forEach(function (name) { return sinkProxies[name]._c(); });
	    };
	}
	function disposeSources(sources) {
	    for (var k in sources) {
	        if (sources.hasOwnProperty(k) &&
	            sources[k] &&
	            sources[k].dispose) {
	            sources[k].dispose();
	        }
	    }
	}
	function isObjectEmpty(obj) {
	    return Object.keys(obj).length === 0;
	}
	/**
	 * A function that prepares the Cycle application to be executed. Takes a `main`
	 * function and prepares to circularly connects it to the given collection of
	 * driver functions. As an output, `setup()` returns an object with three
	 * properties: `sources`, `sinks` and `run`. Only when `run()` is called will
	 * the application actually execute. Refer to the documentation of `run()` for
	 * more details.
	 *
	 * **Example:**
	 * ```js
	 * import {setup} from '@cycle/run';
	 * const {sources, sinks, run} = setup(main, drivers);
	 * // ...
	 * const dispose = run(); // Executes the application
	 * // ...
	 * dispose();
	 * ```
	 *
	 * @param {Function} main a function that takes `sources` as input and outputs
	 * `sinks`.
	 * @param {Object} drivers an object where keys are driver names and values
	 * are driver functions.
	 * @return {Object} an object with three properties: `sources`, `sinks` and
	 * `run`. `sources` is the collection of driver sources, `sinks` is the
	 * collection of driver sinks, these can be used for debugging or testing. `run`
	 * is the function that once called will execute the application.
	 * @function setup
	 */
	function setup(main, drivers) {
	    if (typeof main !== "function") {
	        throw new Error("First argument given to Cycle must be the 'main' " + "function.");
	    }
	    if (typeof drivers !== "object" || drivers === null) {
	        throw new Error("Second argument given to Cycle must be an object " +
	            "with driver functions as properties.");
	    }
	    if (isObjectEmpty(drivers)) {
	        throw new Error("Second argument given to Cycle must be an object " +
	            "with at least one driver function declared as a property.");
	    }
	    var sinkProxies = makeSinkProxies(drivers);
	    var sources = callDrivers(drivers, sinkProxies);
	    var adaptedSources = adaptSources(sources);
	    var sinks = main(adaptedSources);
	    if (typeof window !== 'undefined') {
	        window.Cyclejs = window.Cyclejs || {};
	        window.Cyclejs.sinks = sinks;
	    }
	    function _run() {
	        var disposeReplication = replicateMany(sinks, sinkProxies);
	        return function dispose() {
	            disposeSources(sources);
	            disposeReplication();
	        };
	    }
	    return { sinks: sinks, sources: sources, run: _run };
	}
	exports.setup = setup;
	/**
	 * Takes a `main` function and circularly connects it to the given collection
	 * of driver functions.
	 *
	 * **Example:**
	 * ```js
	 * import run from '@cycle/run';
	 * const dispose = run(main, drivers);
	 * // ...
	 * dispose();
	 * ```
	 *
	 * The `main` function expects a collection of "source" streams (returned from
	 * drivers) as input, and should return a collection of "sink" streams (to be
	 * given to drivers). A "collection of streams" is a JavaScript object where
	 * keys match the driver names registered by the `drivers` object, and values
	 * are the streams. Refer to the documentation of each driver to see more
	 * details on what types of sources it outputs and sinks it receives.
	 *
	 * @param {Function} main a function that takes `sources` as input and outputs
	 * `sinks`.
	 * @param {Object} drivers an object where keys are driver names and values
	 * are driver functions.
	 * @return {Function} a dispose function, used to terminate the execution of the
	 * Cycle.js program, cleaning up resources used.
	 * @function run
	 */
	function run(main, drivers) {
	    var program = setup(main, drivers);
	    if (typeof window !== 'undefined' &&
	        window['CyclejsDevTool_startGraphSerializer']) {
	        window['CyclejsDevTool_startGraphSerializer'](program.sinks);
	    }
	    return program.run();
	}
	exports.run = run;
	exports.default = run;
	//# sourceMappingURL=index.js.map

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	var __extends = (this && this.__extends) || function (d, b) {
	    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	};
	var symbol_observable_1 = __webpack_require__(4);
	var NO = {};
	exports.NO = NO;
	function noop() { }
	function cp(a) {
	    var l = a.length;
	    var b = Array(l);
	    for (var i = 0; i < l; ++i)
	        b[i] = a[i];
	    return b;
	}
	function and(f1, f2) {
	    return function andFn(t) {
	        return f1(t) && f2(t);
	    };
	}
	function _try(c, t, u) {
	    try {
	        return c.f(t);
	    }
	    catch (e) {
	        u._e(e);
	        return NO;
	    }
	}
	var NO_IL = {
	    _n: noop,
	    _e: noop,
	    _c: noop,
	};
	exports.NO_IL = NO_IL;
	// mutates the input
	function internalizeProducer(producer) {
	    producer._start = function _start(il) {
	        il.next = il._n;
	        il.error = il._e;
	        il.complete = il._c;
	        this.start(il);
	    };
	    producer._stop = producer.stop;
	}
	var StreamSub = (function () {
	    function StreamSub(_stream, _listener) {
	        this._stream = _stream;
	        this._listener = _listener;
	    }
	    StreamSub.prototype.unsubscribe = function () {
	        this._stream.removeListener(this._listener);
	    };
	    return StreamSub;
	}());
	var Observer = (function () {
	    function Observer(_listener) {
	        this._listener = _listener;
	    }
	    Observer.prototype.next = function (value) {
	        this._listener._n(value);
	    };
	    Observer.prototype.error = function (err) {
	        this._listener._e(err);
	    };
	    Observer.prototype.complete = function () {
	        this._listener._c();
	    };
	    return Observer;
	}());
	var FromObservable = (function () {
	    function FromObservable(observable) {
	        this.type = 'fromObservable';
	        this.ins = observable;
	        this.active = false;
	    }
	    FromObservable.prototype._start = function (out) {
	        this.out = out;
	        this.active = true;
	        this._sub = this.ins.subscribe(new Observer(out));
	        if (!this.active)
	            this._sub.unsubscribe();
	    };
	    FromObservable.prototype._stop = function () {
	        if (this._sub)
	            this._sub.unsubscribe();
	        this.active = false;
	    };
	    return FromObservable;
	}());
	var Merge = (function () {
	    function Merge(insArr) {
	        this.type = 'merge';
	        this.insArr = insArr;
	        this.out = NO;
	        this.ac = 0;
	    }
	    Merge.prototype._start = function (out) {
	        this.out = out;
	        var s = this.insArr;
	        var L = s.length;
	        this.ac = L;
	        for (var i = 0; i < L; i++)
	            s[i]._add(this);
	    };
	    Merge.prototype._stop = function () {
	        var s = this.insArr;
	        var L = s.length;
	        for (var i = 0; i < L; i++)
	            s[i]._remove(this);
	        this.out = NO;
	    };
	    Merge.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._n(t);
	    };
	    Merge.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Merge.prototype._c = function () {
	        if (--this.ac <= 0) {
	            var u = this.out;
	            if (u === NO)
	                return;
	            u._c();
	        }
	    };
	    return Merge;
	}());
	var CombineListener = (function () {
	    function CombineListener(i, out, p) {
	        this.i = i;
	        this.out = out;
	        this.p = p;
	        p.ils.push(this);
	    }
	    CombineListener.prototype._n = function (t) {
	        var p = this.p, out = this.out;
	        if (out === NO)
	            return;
	        if (p.up(t, this.i)) {
	            var a = p.vals;
	            var l = a.length;
	            var b = Array(l);
	            for (var i = 0; i < l; ++i)
	                b[i] = a[i];
	            out._n(b);
	        }
	    };
	    CombineListener.prototype._e = function (err) {
	        var out = this.out;
	        if (out === NO)
	            return;
	        out._e(err);
	    };
	    CombineListener.prototype._c = function () {
	        var p = this.p;
	        if (p.out === NO)
	            return;
	        if (--p.Nc === 0)
	            p.out._c();
	    };
	    return CombineListener;
	}());
	var Combine = (function () {
	    function Combine(insArr) {
	        this.type = 'combine';
	        this.insArr = insArr;
	        this.out = NO;
	        this.ils = [];
	        this.Nc = this.Nn = 0;
	        this.vals = [];
	    }
	    Combine.prototype.up = function (t, i) {
	        var v = this.vals[i];
	        var Nn = !this.Nn ? 0 : v === NO ? --this.Nn : this.Nn;
	        this.vals[i] = t;
	        return Nn === 0;
	    };
	    Combine.prototype._start = function (out) {
	        this.out = out;
	        var s = this.insArr;
	        var n = this.Nc = this.Nn = s.length;
	        var vals = this.vals = new Array(n);
	        if (n === 0) {
	            out._n([]);
	            out._c();
	        }
	        else {
	            for (var i = 0; i < n; i++) {
	                vals[i] = NO;
	                s[i]._add(new CombineListener(i, out, this));
	            }
	        }
	    };
	    Combine.prototype._stop = function () {
	        var s = this.insArr;
	        var n = s.length;
	        var ils = this.ils;
	        for (var i = 0; i < n; i++)
	            s[i]._remove(ils[i]);
	        this.out = NO;
	        this.ils = [];
	        this.vals = [];
	    };
	    return Combine;
	}());
	var FromArray = (function () {
	    function FromArray(a) {
	        this.type = 'fromArray';
	        this.a = a;
	    }
	    FromArray.prototype._start = function (out) {
	        var a = this.a;
	        for (var i = 0, n = a.length; i < n; i++)
	            out._n(a[i]);
	        out._c();
	    };
	    FromArray.prototype._stop = function () {
	    };
	    return FromArray;
	}());
	var FromPromise = (function () {
	    function FromPromise(p) {
	        this.type = 'fromPromise';
	        this.on = false;
	        this.p = p;
	    }
	    FromPromise.prototype._start = function (out) {
	        var prod = this;
	        this.on = true;
	        this.p.then(function (v) {
	            if (prod.on) {
	                out._n(v);
	                out._c();
	            }
	        }, function (e) {
	            out._e(e);
	        }).then(noop, function (err) {
	            setTimeout(function () { throw err; });
	        });
	    };
	    FromPromise.prototype._stop = function () {
	        this.on = false;
	    };
	    return FromPromise;
	}());
	var Periodic = (function () {
	    function Periodic(period) {
	        this.type = 'periodic';
	        this.period = period;
	        this.intervalID = -1;
	        this.i = 0;
	    }
	    Periodic.prototype._start = function (out) {
	        var self = this;
	        function intervalHandler() { out._n(self.i++); }
	        this.intervalID = setInterval(intervalHandler, this.period);
	    };
	    Periodic.prototype._stop = function () {
	        if (this.intervalID !== -1)
	            clearInterval(this.intervalID);
	        this.intervalID = -1;
	        this.i = 0;
	    };
	    return Periodic;
	}());
	var Debug = (function () {
	    function Debug(ins, arg) {
	        this.type = 'debug';
	        this.ins = ins;
	        this.out = NO;
	        this.s = noop;
	        this.l = '';
	        if (typeof arg === 'string')
	            this.l = arg;
	        else if (typeof arg === 'function')
	            this.s = arg;
	    }
	    Debug.prototype._start = function (out) {
	        this.out = out;
	        this.ins._add(this);
	    };
	    Debug.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	    };
	    Debug.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        var s = this.s, l = this.l;
	        if (s !== noop) {
	            try {
	                s(t);
	            }
	            catch (e) {
	                u._e(e);
	            }
	        }
	        else if (l)
	            console.log(l + ':', t);
	        else
	            console.log(t);
	        u._n(t);
	    };
	    Debug.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Debug.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    return Debug;
	}());
	var Drop = (function () {
	    function Drop(max, ins) {
	        this.type = 'drop';
	        this.ins = ins;
	        this.out = NO;
	        this.max = max;
	        this.dropped = 0;
	    }
	    Drop.prototype._start = function (out) {
	        this.out = out;
	        this.dropped = 0;
	        this.ins._add(this);
	    };
	    Drop.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	    };
	    Drop.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        if (this.dropped++ >= this.max)
	            u._n(t);
	    };
	    Drop.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Drop.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    return Drop;
	}());
	var EndWhenListener = (function () {
	    function EndWhenListener(out, op) {
	        this.out = out;
	        this.op = op;
	    }
	    EndWhenListener.prototype._n = function () {
	        this.op.end();
	    };
	    EndWhenListener.prototype._e = function (err) {
	        this.out._e(err);
	    };
	    EndWhenListener.prototype._c = function () {
	        this.op.end();
	    };
	    return EndWhenListener;
	}());
	var EndWhen = (function () {
	    function EndWhen(o, ins) {
	        this.type = 'endWhen';
	        this.ins = ins;
	        this.out = NO;
	        this.o = o;
	        this.oil = NO_IL;
	    }
	    EndWhen.prototype._start = function (out) {
	        this.out = out;
	        this.o._add(this.oil = new EndWhenListener(out, this));
	        this.ins._add(this);
	    };
	    EndWhen.prototype._stop = function () {
	        this.ins._remove(this);
	        this.o._remove(this.oil);
	        this.out = NO;
	        this.oil = NO_IL;
	    };
	    EndWhen.prototype.end = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    EndWhen.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._n(t);
	    };
	    EndWhen.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    EndWhen.prototype._c = function () {
	        this.end();
	    };
	    return EndWhen;
	}());
	var Filter = (function () {
	    function Filter(passes, ins) {
	        this.type = 'filter';
	        this.ins = ins;
	        this.out = NO;
	        this.f = passes;
	    }
	    Filter.prototype._start = function (out) {
	        this.out = out;
	        this.ins._add(this);
	    };
	    Filter.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	    };
	    Filter.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        var r = _try(this, t, u);
	        if (r === NO || !r)
	            return;
	        u._n(t);
	    };
	    Filter.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Filter.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    return Filter;
	}());
	var FlattenListener = (function () {
	    function FlattenListener(out, op) {
	        this.out = out;
	        this.op = op;
	    }
	    FlattenListener.prototype._n = function (t) {
	        this.out._n(t);
	    };
	    FlattenListener.prototype._e = function (err) {
	        this.out._e(err);
	    };
	    FlattenListener.prototype._c = function () {
	        this.op.inner = NO;
	        this.op.less();
	    };
	    return FlattenListener;
	}());
	var Flatten = (function () {
	    function Flatten(ins) {
	        this.type = 'flatten';
	        this.ins = ins;
	        this.out = NO;
	        this.open = true;
	        this.inner = NO;
	        this.il = NO_IL;
	    }
	    Flatten.prototype._start = function (out) {
	        this.out = out;
	        this.open = true;
	        this.inner = NO;
	        this.il = NO_IL;
	        this.ins._add(this);
	    };
	    Flatten.prototype._stop = function () {
	        this.ins._remove(this);
	        if (this.inner !== NO)
	            this.inner._remove(this.il);
	        this.out = NO;
	        this.open = true;
	        this.inner = NO;
	        this.il = NO_IL;
	    };
	    Flatten.prototype.less = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        if (!this.open && this.inner === NO)
	            u._c();
	    };
	    Flatten.prototype._n = function (s) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        var _a = this, inner = _a.inner, il = _a.il;
	        if (inner !== NO && il !== NO_IL)
	            inner._remove(il);
	        (this.inner = s)._add(this.il = new FlattenListener(u, this));
	    };
	    Flatten.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Flatten.prototype._c = function () {
	        this.open = false;
	        this.less();
	    };
	    return Flatten;
	}());
	var Fold = (function () {
	    function Fold(f, seed, ins) {
	        var _this = this;
	        this.type = 'fold';
	        this.ins = ins;
	        this.out = NO;
	        this.f = function (t) { return f(_this.acc, t); };
	        this.acc = this.seed = seed;
	    }
	    Fold.prototype._start = function (out) {
	        this.out = out;
	        this.acc = this.seed;
	        out._n(this.acc);
	        this.ins._add(this);
	    };
	    Fold.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	        this.acc = this.seed;
	    };
	    Fold.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        var r = _try(this, t, u);
	        if (r === NO)
	            return;
	        u._n(this.acc = r);
	    };
	    Fold.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Fold.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    return Fold;
	}());
	var Last = (function () {
	    function Last(ins) {
	        this.type = 'last';
	        this.ins = ins;
	        this.out = NO;
	        this.has = false;
	        this.val = NO;
	    }
	    Last.prototype._start = function (out) {
	        this.out = out;
	        this.has = false;
	        this.ins._add(this);
	    };
	    Last.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	        this.val = NO;
	    };
	    Last.prototype._n = function (t) {
	        this.has = true;
	        this.val = t;
	    };
	    Last.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Last.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        if (this.has) {
	            u._n(this.val);
	            u._c();
	        }
	        else
	            u._e(new Error('last() failed because input stream completed'));
	    };
	    return Last;
	}());
	var MapOp = (function () {
	    function MapOp(project, ins) {
	        this.type = 'map';
	        this.ins = ins;
	        this.out = NO;
	        this.f = project;
	    }
	    MapOp.prototype._start = function (out) {
	        this.out = out;
	        this.ins._add(this);
	    };
	    MapOp.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	    };
	    MapOp.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        var r = _try(this, t, u);
	        if (r === NO)
	            return;
	        u._n(r);
	    };
	    MapOp.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    MapOp.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    return MapOp;
	}());
	var Remember = (function () {
	    function Remember(ins) {
	        this.type = 'remember';
	        this.ins = ins;
	        this.out = NO;
	    }
	    Remember.prototype._start = function (out) {
	        this.out = out;
	        this.ins._add(out);
	    };
	    Remember.prototype._stop = function () {
	        this.ins._remove(this.out);
	        this.out = NO;
	    };
	    return Remember;
	}());
	var ReplaceError = (function () {
	    function ReplaceError(replacer, ins) {
	        this.type = 'replaceError';
	        this.ins = ins;
	        this.out = NO;
	        this.f = replacer;
	    }
	    ReplaceError.prototype._start = function (out) {
	        this.out = out;
	        this.ins._add(this);
	    };
	    ReplaceError.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	    };
	    ReplaceError.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._n(t);
	    };
	    ReplaceError.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        try {
	            this.ins._remove(this);
	            (this.ins = this.f(err))._add(this);
	        }
	        catch (e) {
	            u._e(e);
	        }
	    };
	    ReplaceError.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    return ReplaceError;
	}());
	var StartWith = (function () {
	    function StartWith(ins, val) {
	        this.type = 'startWith';
	        this.ins = ins;
	        this.out = NO;
	        this.val = val;
	    }
	    StartWith.prototype._start = function (out) {
	        this.out = out;
	        this.out._n(this.val);
	        this.ins._add(out);
	    };
	    StartWith.prototype._stop = function () {
	        this.ins._remove(this.out);
	        this.out = NO;
	    };
	    return StartWith;
	}());
	var Take = (function () {
	    function Take(max, ins) {
	        this.type = 'take';
	        this.ins = ins;
	        this.out = NO;
	        this.max = max;
	        this.taken = 0;
	    }
	    Take.prototype._start = function (out) {
	        this.out = out;
	        this.taken = 0;
	        if (this.max <= 0)
	            out._c();
	        else
	            this.ins._add(this);
	    };
	    Take.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = NO;
	    };
	    Take.prototype._n = function (t) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        var m = ++this.taken;
	        if (m < this.max)
	            u._n(t);
	        else if (m === this.max) {
	            u._n(t);
	            u._c();
	        }
	    };
	    Take.prototype._e = function (err) {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._e(err);
	    };
	    Take.prototype._c = function () {
	        var u = this.out;
	        if (u === NO)
	            return;
	        u._c();
	    };
	    return Take;
	}());
	var Stream = (function () {
	    function Stream(producer) {
	        this._prod = producer || NO;
	        this._ils = [];
	        this._stopID = NO;
	        this._dl = NO;
	        this._d = false;
	        this._target = NO;
	        this._err = NO;
	    }
	    Stream.prototype._n = function (t) {
	        var a = this._ils;
	        var L = a.length;
	        if (this._d)
	            this._dl._n(t);
	        if (L == 1)
	            a[0]._n(t);
	        else if (L == 0)
	            return;
	        else {
	            var b = cp(a);
	            for (var i = 0; i < L; i++)
	                b[i]._n(t);
	        }
	    };
	    Stream.prototype._e = function (err) {
	        if (this._err !== NO)
	            return;
	        this._err = err;
	        var a = this._ils;
	        var L = a.length;
	        this._x();
	        if (this._d)
	            this._dl._e(err);
	        if (L == 1)
	            a[0]._e(err);
	        else if (L == 0)
	            return;
	        else {
	            var b = cp(a);
	            for (var i = 0; i < L; i++)
	                b[i]._e(err);
	        }
	        if (!this._d && L == 0)
	            throw this._err;
	    };
	    Stream.prototype._c = function () {
	        var a = this._ils;
	        var L = a.length;
	        this._x();
	        if (this._d)
	            this._dl._c();
	        if (L == 1)
	            a[0]._c();
	        else if (L == 0)
	            return;
	        else {
	            var b = cp(a);
	            for (var i = 0; i < L; i++)
	                b[i]._c();
	        }
	    };
	    Stream.prototype._x = function () {
	        if (this._ils.length === 0)
	            return;
	        if (this._prod !== NO)
	            this._prod._stop();
	        this._err = NO;
	        this._ils = [];
	    };
	    Stream.prototype._stopNow = function () {
	        // WARNING: code that calls this method should
	        // first check if this._prod is valid (not `NO`)
	        this._prod._stop();
	        this._err = NO;
	        this._stopID = NO;
	    };
	    Stream.prototype._add = function (il) {
	        var ta = this._target;
	        if (ta !== NO)
	            return ta._add(il);
	        var a = this._ils;
	        a.push(il);
	        if (a.length > 1)
	            return;
	        if (this._stopID !== NO) {
	            clearTimeout(this._stopID);
	            this._stopID = NO;
	        }
	        else {
	            var p = this._prod;
	            if (p !== NO)
	                p._start(this);
	        }
	    };
	    Stream.prototype._remove = function (il) {
	        var _this = this;
	        var ta = this._target;
	        if (ta !== NO)
	            return ta._remove(il);
	        var a = this._ils;
	        var i = a.indexOf(il);
	        if (i > -1) {
	            a.splice(i, 1);
	            if (this._prod !== NO && a.length <= 0) {
	                this._err = NO;
	                this._stopID = setTimeout(function () { return _this._stopNow(); });
	            }
	            else if (a.length === 1) {
	                this._pruneCycles();
	            }
	        }
	    };
	    // If all paths stemming from `this` stream eventually end at `this`
	    // stream, then we remove the single listener of `this` stream, to
	    // force it to end its execution and dispose resources. This method
	    // assumes as a precondition that this._ils has just one listener.
	    Stream.prototype._pruneCycles = function () {
	        if (this._hasNoSinks(this, []))
	            this._remove(this._ils[0]);
	    };
	    // Checks whether *there is no* path starting from `x` that leads to an end
	    // listener (sink) in the stream graph, following edges A->B where B is a
	    // listener of A. This means these paths constitute a cycle somehow. Is given
	    // a trace of all visited nodes so far.
	    Stream.prototype._hasNoSinks = function (x, trace) {
	        if (trace.indexOf(x) !== -1)
	            return true;
	        else if (x.out === this)
	            return true;
	        else if (x.out && x.out !== NO)
	            return this._hasNoSinks(x.out, trace.concat(x));
	        else if (x._ils) {
	            for (var i = 0, N = x._ils.length; i < N; i++)
	                if (!this._hasNoSinks(x._ils[i], trace.concat(x)))
	                    return false;
	            return true;
	        }
	        else
	            return false;
	    };
	    Stream.prototype.ctor = function () {
	        return this instanceof MemoryStream ? MemoryStream : Stream;
	    };
	    /**
	     * Adds a Listener to the Stream.
	     *
	     * @param {Listener} listener
	     */
	    Stream.prototype.addListener = function (listener) {
	        listener._n = listener.next || noop;
	        listener._e = listener.error || noop;
	        listener._c = listener.complete || noop;
	        this._add(listener);
	    };
	    /**
	     * Removes a Listener from the Stream, assuming the Listener was added to it.
	     *
	     * @param {Listener<T>} listener
	     */
	    Stream.prototype.removeListener = function (listener) {
	        this._remove(listener);
	    };
	    /**
	     * Adds a Listener to the Stream returning a Subscription to remove that
	     * listener.
	     *
	     * @param {Listener} listener
	     * @returns {Subscription}
	     */
	    Stream.prototype.subscribe = function (listener) {
	        this.addListener(listener);
	        return new StreamSub(this, listener);
	    };
	    /**
	     * Add interop between most.js and RxJS 5
	     *
	     * @returns {Stream}
	     */
	    Stream.prototype[symbol_observable_1.default] = function () {
	        return this;
	    };
	    /**
	     * Creates a new Stream given a Producer.
	     *
	     * @factory true
	     * @param {Producer} producer An optional Producer that dictates how to
	     * start, generate events, and stop the Stream.
	     * @return {Stream}
	     */
	    Stream.create = function (producer) {
	        if (producer) {
	            if (typeof producer.start !== 'function'
	                || typeof producer.stop !== 'function')
	                throw new Error('producer requires both start and stop functions');
	            internalizeProducer(producer); // mutates the input
	        }
	        return new Stream(producer);
	    };
	    /**
	     * Creates a new MemoryStream given a Producer.
	     *
	     * @factory true
	     * @param {Producer} producer An optional Producer that dictates how to
	     * start, generate events, and stop the Stream.
	     * @return {MemoryStream}
	     */
	    Stream.createWithMemory = function (producer) {
	        if (producer)
	            internalizeProducer(producer); // mutates the input
	        return new MemoryStream(producer);
	    };
	    /**
	     * Creates a Stream that does nothing when started. It never emits any event.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     *          never
	     * -----------------------
	     * ```
	     *
	     * @factory true
	     * @return {Stream}
	     */
	    Stream.never = function () {
	        return new Stream({ _start: noop, _stop: noop });
	    };
	    /**
	     * Creates a Stream that immediately emits the "complete" notification when
	     * started, and that's it.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * empty
	     * -|
	     * ```
	     *
	     * @factory true
	     * @return {Stream}
	     */
	    Stream.empty = function () {
	        return new Stream({
	            _start: function (il) { il._c(); },
	            _stop: noop,
	        });
	    };
	    /**
	     * Creates a Stream that immediately emits an "error" notification with the
	     * value you passed as the `error` argument when the stream starts, and that's
	     * it.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * throw(X)
	     * -X
	     * ```
	     *
	     * @factory true
	     * @param error The error event to emit on the created stream.
	     * @return {Stream}
	     */
	    Stream.throw = function (error) {
	        return new Stream({
	            _start: function (il) { il._e(error); },
	            _stop: noop,
	        });
	    };
	    /**
	     * Creates a stream from an Array, Promise, or an Observable.
	     *
	     * @factory true
	     * @param {Array|PromiseLike|Observable} input The input to make a stream from.
	     * @return {Stream}
	     */
	    Stream.from = function (input) {
	        if (typeof input[symbol_observable_1.default] === 'function')
	            return Stream.fromObservable(input);
	        else if (typeof input.then === 'function')
	            return Stream.fromPromise(input);
	        else if (Array.isArray(input))
	            return Stream.fromArray(input);
	        throw new TypeError("Type of input to from() must be an Array, Promise, or Observable");
	    };
	    /**
	     * Creates a Stream that immediately emits the arguments that you give to
	     * *of*, then completes.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * of(1,2,3)
	     * 123|
	     * ```
	     *
	     * @factory true
	     * @param a The first value you want to emit as an event on the stream.
	     * @param b The second value you want to emit as an event on the stream. One
	     * or more of these values may be given as arguments.
	     * @return {Stream}
	     */
	    Stream.of = function () {
	        var items = [];
	        for (var _i = 0; _i < arguments.length; _i++) {
	            items[_i] = arguments[_i];
	        }
	        return Stream.fromArray(items);
	    };
	    /**
	     * Converts an array to a stream. The returned stream will emit synchronously
	     * all the items in the array, and then complete.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * fromArray([1,2,3])
	     * 123|
	     * ```
	     *
	     * @factory true
	     * @param {Array} array The array to be converted as a stream.
	     * @return {Stream}
	     */
	    Stream.fromArray = function (array) {
	        return new Stream(new FromArray(array));
	    };
	    /**
	     * Converts a promise to a stream. The returned stream will emit the resolved
	     * value of the promise, and then complete. However, if the promise is
	     * rejected, the stream will emit the corresponding error.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * fromPromise( ----42 )
	     * -----------------42|
	     * ```
	     *
	     * @factory true
	     * @param {PromiseLike} promise The promise to be converted as a stream.
	     * @return {Stream}
	     */
	    Stream.fromPromise = function (promise) {
	        return new Stream(new FromPromise(promise));
	    };
	    /**
	     * Converts an Observable into a Stream.
	     *
	     * @factory true
	     * @param {any} observable The observable to be converted as a stream.
	     * @return {Stream}
	     */
	    Stream.fromObservable = function (obs) {
	        if (obs.endWhen)
	            return obs;
	        return new Stream(new FromObservable(obs));
	    };
	    /**
	     * Creates a stream that periodically emits incremental numbers, every
	     * `period` milliseconds.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     *     periodic(1000)
	     * ---0---1---2---3---4---...
	     * ```
	     *
	     * @factory true
	     * @param {number} period The interval in milliseconds to use as a rate of
	     * emission.
	     * @return {Stream}
	     */
	    Stream.periodic = function (period) {
	        return new Stream(new Periodic(period));
	    };
	    Stream.prototype._map = function (project) {
	        return new (this.ctor())(new MapOp(project, this));
	    };
	    /**
	     * Transforms each event from the input Stream through a `project` function,
	     * to get a Stream that emits those transformed events.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --1---3--5-----7------
	     *    map(i => i * 10)
	     * --10--30-50----70-----
	     * ```
	     *
	     * @param {Function} project A function of type `(t: T) => U` that takes event
	     * `t` of type `T` from the input Stream and produces an event of type `U`, to
	     * be emitted on the output Stream.
	     * @return {Stream}
	     */
	    Stream.prototype.map = function (project) {
	        return this._map(project);
	    };
	    /**
	     * It's like `map`, but transforms each input event to always the same
	     * constant value on the output Stream.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --1---3--5-----7-----
	     *       mapTo(10)
	     * --10--10-10----10----
	     * ```
	     *
	     * @param projectedValue A value to emit on the output Stream whenever the
	     * input Stream emits any value.
	     * @return {Stream}
	     */
	    Stream.prototype.mapTo = function (projectedValue) {
	        var s = this.map(function () { return projectedValue; });
	        var op = s._prod;
	        op.type = 'mapTo';
	        return s;
	    };
	    /**
	     * Only allows events that pass the test given by the `passes` argument.
	     *
	     * Each event from the input stream is given to the `passes` function. If the
	     * function returns `true`, the event is forwarded to the output stream,
	     * otherwise it is ignored and not forwarded.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --1---2--3-----4-----5---6--7-8--
	     *     filter(i => i % 2 === 0)
	     * ------2--------4---------6----8--
	     * ```
	     *
	     * @param {Function} passes A function of type `(t: T) +> boolean` that takes
	     * an event from the input stream and checks if it passes, by returning a
	     * boolean.
	     * @return {Stream}
	     */
	    Stream.prototype.filter = function (passes) {
	        var p = this._prod;
	        if (p instanceof Filter)
	            return new Stream(new Filter(and(p.f, passes), p.ins));
	        return new Stream(new Filter(passes, this));
	    };
	    /**
	     * Lets the first `amount` many events from the input stream pass to the
	     * output stream, then makes the output stream complete.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --a---b--c----d---e--
	     *    take(3)
	     * --a---b--c|
	     * ```
	     *
	     * @param {number} amount How many events to allow from the input stream
	     * before completing the output stream.
	     * @return {Stream}
	     */
	    Stream.prototype.take = function (amount) {
	        return new (this.ctor())(new Take(amount, this));
	    };
	    /**
	     * Ignores the first `amount` many events from the input stream, and then
	     * after that starts forwarding events from the input stream to the output
	     * stream.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --a---b--c----d---e--
	     *       drop(3)
	     * --------------d---e--
	     * ```
	     *
	     * @param {number} amount How many events to ignore from the input stream
	     * before forwarding all events from the input stream to the output stream.
	     * @return {Stream}
	     */
	    Stream.prototype.drop = function (amount) {
	        return new Stream(new Drop(amount, this));
	    };
	    /**
	     * When the input stream completes, the output stream will emit the last event
	     * emitted by the input stream, and then will also complete.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --a---b--c--d----|
	     *       last()
	     * -----------------d|
	     * ```
	     *
	     * @return {Stream}
	     */
	    Stream.prototype.last = function () {
	        return new Stream(new Last(this));
	    };
	    /**
	     * Prepends the given `initial` value to the sequence of events emitted by the
	     * input stream. The returned stream is a MemoryStream, which means it is
	     * already `remember()`'d.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * ---1---2-----3---
	     *   startWith(0)
	     * 0--1---2-----3---
	     * ```
	     *
	     * @param initial The value or event to prepend.
	     * @return {MemoryStream}
	     */
	    Stream.prototype.startWith = function (initial) {
	        return new MemoryStream(new StartWith(this, initial));
	    };
	    /**
	     * Uses another stream to determine when to complete the current stream.
	     *
	     * When the given `other` stream emits an event or completes, the output
	     * stream will complete. Before that happens, the output stream will behaves
	     * like the input stream.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * ---1---2-----3--4----5----6---
	     *   endWhen( --------a--b--| )
	     * ---1---2-----3--4--|
	     * ```
	     *
	     * @param other Some other stream that is used to know when should the output
	     * stream of this operator complete.
	     * @return {Stream}
	     */
	    Stream.prototype.endWhen = function (other) {
	        return new (this.ctor())(new EndWhen(other, this));
	    };
	    /**
	     * "Folds" the stream onto itself.
	     *
	     * Combines events from the past throughout
	     * the entire execution of the input stream, allowing you to accumulate them
	     * together. It's essentially like `Array.prototype.reduce`. The returned
	     * stream is a MemoryStream, which means it is already `remember()`'d.
	     *
	     * The output stream starts by emitting the `seed` which you give as argument.
	     * Then, when an event happens on the input stream, it is combined with that
	     * seed value through the `accumulate` function, and the output value is
	     * emitted on the output stream. `fold` remembers that output value as `acc`
	     * ("accumulator"), and then when a new input event `t` happens, `acc` will be
	     * combined with that to produce the new `acc` and so forth.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * ------1-----1--2----1----1------
	     *   fold((acc, x) => acc + x, 3)
	     * 3-----4-----5--7----8----9------
	     * ```
	     *
	     * @param {Function} accumulate A function of type `(acc: R, t: T) => R` that
	     * takes the previous accumulated value `acc` and the incoming event from the
	     * input stream and produces the new accumulated value.
	     * @param seed The initial accumulated value, of type `R`.
	     * @return {MemoryStream}
	     */
	    Stream.prototype.fold = function (accumulate, seed) {
	        return new MemoryStream(new Fold(accumulate, seed, this));
	    };
	    /**
	     * Replaces an error with another stream.
	     *
	     * When (and if) an error happens on the input stream, instead of forwarding
	     * that error to the output stream, *replaceError* will call the `replace`
	     * function which returns the stream that the output stream will replicate.
	     * And, in case that new stream also emits an error, `replace` will be called
	     * again to get another stream to start replicating.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --1---2-----3--4-----X
	     *   replaceError( () => --10--| )
	     * --1---2-----3--4--------10--|
	     * ```
	     *
	     * @param {Function} replace A function of type `(err) => Stream` that takes
	     * the error that occurred on the input stream or on the previous replacement
	     * stream and returns a new stream. The output stream will behave like the
	     * stream that this function returns.
	     * @return {Stream}
	     */
	    Stream.prototype.replaceError = function (replace) {
	        return new (this.ctor())(new ReplaceError(replace, this));
	    };
	    /**
	     * Flattens a "stream of streams", handling only one nested stream at a time
	     * (no concurrency).
	     *
	     * If the input stream is a stream that emits streams, then this operator will
	     * return an output stream which is a flat stream: emits regular events. The
	     * flattening happens without concurrency. It works like this: when the input
	     * stream emits a nested stream, *flatten* will start imitating that nested
	     * one. However, as soon as the next nested stream is emitted on the input
	     * stream, *flatten* will forget the previous nested one it was imitating, and
	     * will start imitating the new nested one.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --+--------+---------------
	     *   \        \
	     *    \       ----1----2---3--
	     *    --a--b----c----d--------
	     *           flatten
	     * -----a--b------1----2---3--
	     * ```
	     *
	     * @return {Stream}
	     */
	    Stream.prototype.flatten = function () {
	        var p = this._prod;
	        return new Stream(new Flatten(this));
	    };
	    /**
	     * Passes the input stream to a custom operator, to produce an output stream.
	     *
	     * *compose* is a handy way of using an existing function in a chained style.
	     * Instead of writing `outStream = f(inStream)` you can write
	     * `outStream = inStream.compose(f)`.
	     *
	     * @param {function} operator A function that takes a stream as input and
	     * returns a stream as well.
	     * @return {Stream}
	     */
	    Stream.prototype.compose = function (operator) {
	        return operator(this);
	    };
	    /**
	     * Returns an output stream that behaves like the input stream, but also
	     * remembers the most recent event that happens on the input stream, so that a
	     * newly added listener will immediately receive that memorised event.
	     *
	     * @return {MemoryStream}
	     */
	    Stream.prototype.remember = function () {
	        return new MemoryStream(new Remember(this));
	    };
	    /**
	     * Returns an output stream that identically behaves like the input stream,
	     * but also runs a `spy` function for each event, to help you debug your app.
	     *
	     * *debug* takes a `spy` function as argument, and runs that for each event
	     * happening on the input stream. If you don't provide the `spy` argument,
	     * then *debug* will just `console.log` each event. This helps you to
	     * understand the flow of events through some operator chain.
	     *
	     * Please note that if the output stream has no listeners, then it will not
	     * start, which means `spy` will never run because no actual event happens in
	     * that case.
	     *
	     * Marble diagram:
	     *
	     * ```text
	     * --1----2-----3-----4--
	     *         debug
	     * --1----2-----3-----4--
	     * ```
	     *
	     * @param {function} labelOrSpy A string to use as the label when printing
	     * debug information on the console, or a 'spy' function that takes an event
	     * as argument, and does not need to return anything.
	     * @return {Stream}
	     */
	    Stream.prototype.debug = function (labelOrSpy) {
	        return new (this.ctor())(new Debug(this, labelOrSpy));
	    };
	    /**
	     * *imitate* changes this current Stream to emit the same events that the
	     * `other` given Stream does. This method returns nothing.
	     *
	     * This method exists to allow one thing: **circular dependency of streams**.
	     * For instance, let's imagine that for some reason you need to create a
	     * circular dependency where stream `first$` depends on stream `second$`
	     * which in turn depends on `first$`:
	     *
	     * <!-- skip-example -->
	     * ```js
	     * import delay from 'xstream/extra/delay'
	     *
	     * var first$ = second$.map(x => x * 10).take(3);
	     * var second$ = first$.map(x => x + 1).startWith(1).compose(delay(100));
	     * ```
	     *
	     * However, that is invalid JavaScript, because `second$` is undefined
	     * on the first line. This is how *imitate* can help solve it:
	     *
	     * ```js
	     * import delay from 'xstream/extra/delay'
	     *
	     * var secondProxy$ = xs.create();
	     * var first$ = secondProxy$.map(x => x * 10).take(3);
	     * var second$ = first$.map(x => x + 1).startWith(1).compose(delay(100));
	     * secondProxy$.imitate(second$);
	     * ```
	     *
	     * We create `secondProxy$` before the others, so it can be used in the
	     * declaration of `first$`. Then, after both `first$` and `second$` are
	     * defined, we hook `secondProxy$` with `second$` with `imitate()` to tell
	     * that they are "the same". `imitate` will not trigger the start of any
	     * stream, it just binds `secondProxy$` and `second$` together.
	     *
	     * The following is an example where `imitate()` is important in Cycle.js
	     * applications. A parent component contains some child components. A child
	     * has an action stream which is given to the parent to define its state:
	     *
	     * <!-- skip-example -->
	     * ```js
	     * const childActionProxy$ = xs.create();
	     * const parent = Parent({...sources, childAction$: childActionProxy$});
	     * const childAction$ = parent.state$.map(s => s.child.action$).flatten();
	     * childActionProxy$.imitate(childAction$);
	     * ```
	     *
	     * Note, though, that **`imitate()` does not support MemoryStreams**. If we
	     * would attempt to imitate a MemoryStream in a circular dependency, we would
	     * either get a race condition (where the symptom would be "nothing happens")
	     * or an infinite cyclic emission of values. It's useful to think about
	     * MemoryStreams as cells in a spreadsheet. It doesn't make any sense to
	     * define a spreadsheet cell `A1` with a formula that depends on `B1` and
	     * cell `B1` defined with a formula that depends on `A1`.
	     *
	     * If you find yourself wanting to use `imitate()` with a
	     * MemoryStream, you should rework your code around `imitate()` to use a
	     * Stream instead. Look for the stream in the circular dependency that
	     * represents an event stream, and that would be a candidate for creating a
	     * proxy Stream which then imitates the target Stream.
	     *
	     * @param {Stream} target The other stream to imitate on the current one. Must
	     * not be a MemoryStream.
	     */
	    Stream.prototype.imitate = function (target) {
	        if (target instanceof MemoryStream)
	            throw new Error('A MemoryStream was given to imitate(), but it only ' +
	                'supports a Stream. Read more about this restriction here: ' +
	                'https://github.com/staltz/xstream#faq');
	        this._target = target;
	        for (var ils = this._ils, N = ils.length, i = 0; i < N; i++)
	            target._add(ils[i]);
	        this._ils = [];
	    };
	    /**
	     * Forces the Stream to emit the given value to its listeners.
	     *
	     * As the name indicates, if you use this, you are most likely doing something
	     * The Wrong Way. Please try to understand the reactive way before using this
	     * method. Use it only when you know what you are doing.
	     *
	     * @param value The "next" value you want to broadcast to all listeners of
	     * this Stream.
	     */
	    Stream.prototype.shamefullySendNext = function (value) {
	        this._n(value);
	    };
	    /**
	     * Forces the Stream to emit the given error to its listeners.
	     *
	     * As the name indicates, if you use this, you are most likely doing something
	     * The Wrong Way. Please try to understand the reactive way before using this
	     * method. Use it only when you know what you are doing.
	     *
	     * @param {any} error The error you want to broadcast to all the listeners of
	     * this Stream.
	     */
	    Stream.prototype.shamefullySendError = function (error) {
	        this._e(error);
	    };
	    /**
	     * Forces the Stream to emit the "completed" event to its listeners.
	     *
	     * As the name indicates, if you use this, you are most likely doing something
	     * The Wrong Way. Please try to understand the reactive way before using this
	     * method. Use it only when you know what you are doing.
	     */
	    Stream.prototype.shamefullySendComplete = function () {
	        this._c();
	    };
	    /**
	     * Adds a "debug" listener to the stream. There can only be one debug
	     * listener, that's why this is 'setDebugListener'. To remove the debug
	     * listener, just call setDebugListener(null).
	     *
	     * A debug listener is like any other listener. The only difference is that a
	     * debug listener is "stealthy": its presence/absence does not trigger the
	     * start/stop of the stream (or the producer inside the stream). This is
	     * useful so you can inspect what is going on without changing the behavior
	     * of the program. If you have an idle stream and you add a normal listener to
	     * it, the stream will start executing. But if you set a debug listener on an
	     * idle stream, it won't start executing (not until the first normal listener
	     * is added).
	     *
	     * As the name indicates, we don't recommend using this method to build app
	     * logic. In fact, in most cases the debug operator works just fine. Only use
	     * this one if you know what you're doing.
	     *
	     * @param {Listener<T>} listener
	     */
	    Stream.prototype.setDebugListener = function (listener) {
	        if (!listener) {
	            this._d = false;
	            this._dl = NO;
	        }
	        else {
	            this._d = true;
	            listener._n = listener.next || noop;
	            listener._e = listener.error || noop;
	            listener._c = listener.complete || noop;
	            this._dl = listener;
	        }
	    };
	    return Stream;
	}());
	/**
	 * Blends multiple streams together, emitting events from all of them
	 * concurrently.
	 *
	 * *merge* takes multiple streams as arguments, and creates a stream that
	 * behaves like each of the argument streams, in parallel.
	 *
	 * Marble diagram:
	 *
	 * ```text
	 * --1----2-----3--------4---
	 * ----a-----b----c---d------
	 *            merge
	 * --1-a--2--b--3-c---d--4---
	 * ```
	 *
	 * @factory true
	 * @param {Stream} stream1 A stream to merge together with other streams.
	 * @param {Stream} stream2 A stream to merge together with other streams. Two
	 * or more streams may be given as arguments.
	 * @return {Stream}
	 */
	Stream.merge = function merge() {
	    var streams = [];
	    for (var _i = 0; _i < arguments.length; _i++) {
	        streams[_i] = arguments[_i];
	    }
	    return new Stream(new Merge(streams));
	};
	/**
	 * Combines multiple input streams together to return a stream whose events
	 * are arrays that collect the latest events from each input stream.
	 *
	 * *combine* internally remembers the most recent event from each of the input
	 * streams. When any of the input streams emits an event, that event together
	 * with all the other saved events are combined into an array. That array will
	 * be emitted on the output stream. It's essentially a way of joining together
	 * the events from multiple streams.
	 *
	 * Marble diagram:
	 *
	 * ```text
	 * --1----2-----3--------4---
	 * ----a-----b-----c--d------
	 *          combine
	 * ----1a-2a-2b-3b-3c-3d-4d--
	 * ```
	 *
	 * Note: to minimize garbage collection, *combine* uses the same array
	 * instance for each emission.  If you need to compare emissions over time,
	 * cache the values with `map` first:
	 *
	 * ```js
	 * import pairwise from 'xstream/extra/pairwise'
	 *
	 * const stream1 = xs.of(1);
	 * const stream2 = xs.of(2);
	 *
	 * xs.combine(stream1, stream2).map(
	 *   combinedEmissions => ([ ...combinedEmissions ])
	 * ).compose(pairwise)
	 * ```
	 *
	 * @factory true
	 * @param {Stream} stream1 A stream to combine together with other streams.
	 * @param {Stream} stream2 A stream to combine together with other streams.
	 * Multiple streams, not just two, may be given as arguments.
	 * @return {Stream}
	 */
	Stream.combine = function combine() {
	    var streams = [];
	    for (var _i = 0; _i < arguments.length; _i++) {
	        streams[_i] = arguments[_i];
	    }
	    return new Stream(new Combine(streams));
	};
	exports.Stream = Stream;
	var MemoryStream = (function (_super) {
	    __extends(MemoryStream, _super);
	    function MemoryStream(producer) {
	        var _this = _super.call(this, producer) || this;
	        _this._has = false;
	        return _this;
	    }
	    MemoryStream.prototype._n = function (x) {
	        this._v = x;
	        this._has = true;
	        _super.prototype._n.call(this, x);
	    };
	    MemoryStream.prototype._add = function (il) {
	        var ta = this._target;
	        if (ta !== NO)
	            return ta._add(il);
	        var a = this._ils;
	        a.push(il);
	        if (a.length > 1) {
	            if (this._has)
	                il._n(this._v);
	            return;
	        }
	        if (this._stopID !== NO) {
	            if (this._has)
	                il._n(this._v);
	            clearTimeout(this._stopID);
	            this._stopID = NO;
	        }
	        else if (this._has)
	            il._n(this._v);
	        else {
	            var p = this._prod;
	            if (p !== NO)
	                p._start(this);
	        }
	    };
	    MemoryStream.prototype._stopNow = function () {
	        this._has = false;
	        _super.prototype._stopNow.call(this);
	    };
	    MemoryStream.prototype._x = function () {
	        this._has = false;
	        _super.prototype._x.call(this);
	    };
	    MemoryStream.prototype.map = function (project) {
	        return this._map(project);
	    };
	    MemoryStream.prototype.mapTo = function (projectedValue) {
	        return _super.prototype.mapTo.call(this, projectedValue);
	    };
	    MemoryStream.prototype.take = function (amount) {
	        return _super.prototype.take.call(this, amount);
	    };
	    MemoryStream.prototype.endWhen = function (other) {
	        return _super.prototype.endWhen.call(this, other);
	    };
	    MemoryStream.prototype.replaceError = function (replace) {
	        return _super.prototype.replaceError.call(this, replace);
	    };
	    MemoryStream.prototype.remember = function () {
	        return this;
	    };
	    MemoryStream.prototype.debug = function (labelOrSpy) {
	        return _super.prototype.debug.call(this, labelOrSpy);
	    };
	    return MemoryStream;
	}(Stream));
	exports.MemoryStream = MemoryStream;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = Stream;
	//# sourceMappingURL=index.js.map

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(5);


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, module) {'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _ponyfill = __webpack_require__(7);
	
	var _ponyfill2 = _interopRequireDefault(_ponyfill);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }
	
	var root; /* global window */
	
	
	if (typeof self !== 'undefined') {
	  root = self;
	} else if (typeof window !== 'undefined') {
	  root = window;
	} else if (typeof global !== 'undefined') {
	  root = global;
	} else if (true) {
	  root = module;
	} else {
	  root = Function('return this')();
	}
	
	var result = (0, _ponyfill2['default'])(root);
	exports['default'] = result;
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(6)(module)))

/***/ }),
/* 6 */
/***/ (function(module, exports) {

	module.exports = function(module) {
		if(!module.webpackPolyfill) {
			module.deprecate = function() {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	}


/***/ }),
/* 7 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	exports['default'] = symbolObservablePonyfill;
	function symbolObservablePonyfill(root) {
		var result;
		var _Symbol = root.Symbol;
	
		if (typeof _Symbol === 'function') {
			if (_Symbol.observable) {
				result = _Symbol.observable;
			} else {
				result = _Symbol('observable');
				_Symbol.observable = result;
			}
		} else {
			result = '@@observable';
		}
	
		return result;
	};

/***/ }),
/* 8 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function getGlobal() {
	    var globalObj;
	    if (typeof window !== 'undefined') {
	        globalObj = window;
	    }
	    else if (typeof global !== 'undefined') {
	        globalObj = global;
	    }
	    else {
	        globalObj = this;
	    }
	    globalObj.Cyclejs = globalObj.Cyclejs || {};
	    globalObj = globalObj.Cyclejs;
	    globalObj.adaptStream = globalObj.adaptStream || (function (x) { return x; });
	    return globalObj;
	}
	function setAdapt(f) {
	    getGlobal().adaptStream = f;
	}
	exports.setAdapt = setAdapt;
	function adapt(stream) {
	    return getGlobal().adaptStream(stream);
	}
	exports.adapt = adapt;
	//# sourceMappingURL=adapt.js.map
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var thunk_1 = __webpack_require__(10);
	exports.thunk = thunk_1.thunk;
	var MainDOMSource_1 = __webpack_require__(14);
	exports.MainDOMSource = MainDOMSource_1.MainDOMSource;
	/**
	 * A factory for the DOM driver function.
	 *
	 * Takes a `container` to define the target on the existing DOM which this
	 * driver will operate on, and an `options` object as the second argument. The
	 * input to this driver is a stream of virtual DOM objects, or in other words,
	 * Snabbdom "VNode" objects. The output of this driver is a "DOMSource": a
	 * collection of Observables queried with the methods `select()` and `events()`.
	 *
	 * `DOMSource.select(selector)` returns a new DOMSource with scope restricted to
	 * the element(s) that matches the CSS `selector` given.
	 *
	 * `DOMSource.events(eventType, options)` returns a stream of events of
	 * `eventType` happening on the elements that match the current DOMSource. The
	 * event object contains the `ownerTarget` property that behaves exactly like
	 * `currentTarget`. The reason for this is that some browsers doesn't allow
	 * `currentTarget` property to be mutated, hence a new property is created. The
	 * returned stream is an *xstream* Stream if you use `@cycle/xstream-run` to run
	 * your app with this driver, or it is an RxJS Observable if you use
	 * `@cycle/rxjs-run`, and so forth. The `options` parameter can have the
	 * property `useCapture`, which is by default `false`, except it is `true` for
	 * event types that do not bubble. Read more here
	 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
	 * about the `useCapture` and its purpose.
	 * The other option is `preventDefault` that is set to false by default.
	 * If set to true, the driver will automatically call `preventDefault()` on every event.
	 *
	 * `DOMSource.elements()` returns a stream of the DOM element(s) matched by the
	 * selectors in the DOMSource. Also, `DOMSource.select(':root').elements()`
	 * returns a stream of DOM element corresponding to the root (or container) of
	 * the app on the DOM.
	 *
	 * @param {(String|HTMLElement)} container the DOM selector for the element
	 * (or the element itself) to contain the rendering of the VTrees.
	 * @param {DOMDriverOptions} options an object with two optional properties:
	 *
	 *   - `modules: array` overrides `@cycle/dom`'s default Snabbdom modules as
	 *     as defined in [`src/modules.ts`](./src/modules.ts).
	 *   - `transposition: boolean` enables/disables transposition of inner streams
	 *     in the virtual DOM tree.
	 * @return {Function} the DOM driver function. The function expects a stream of
	 * VNode as input, and outputs the DOMSource object.
	 * @function makeDOMDriver
	 */
	var makeDOMDriver_1 = __webpack_require__(25);
	exports.makeDOMDriver = makeDOMDriver_1.makeDOMDriver;
	/**
	 * A factory function to create mocked DOMSource objects, for testing purposes.
	 *
	 * Takes a `mockConfig` object as argument, and returns
	 * a DOMSource that can be given to any Cycle.js app that expects a DOMSource in
	 * the sources, for testing.
	 *
	 * The `mockConfig` parameter is an object specifying selectors, eventTypes and
	 * their streams. Example:
	 *
	 * ```js
	 * const domSource = mockDOMSource({
	 *   '.foo': {
	 *     'click': xs.of({target: {}}),
	 *     'mouseover': xs.of({target: {}}),
	 *   },
	 *   '.bar': {
	 *     'scroll': xs.of({target: {}}),
	 *     elements: xs.of({tagName: 'div'}),
	 *   }
	 * });
	 *
	 * // Usage
	 * const click$ = domSource.select('.foo').events('click');
	 * const element$ = domSource.select('.bar').elements();
	 * ```
	 *
	 * The mocked DOM Source supports isolation. It has the functions `isolateSink`
	 * and `isolateSource` attached to it, and performs simple isolation using
	 * classNames. *isolateSink* with scope `foo` will append the class `___foo` to
	 * the stream of virtual DOM nodes, and *isolateSource* with scope `foo` will
	 * perform a conventional `mockedDOMSource.select('.__foo')` call.
	 *
	 * @param {Object} mockConfig an object where keys are selector strings
	 * and values are objects. Those nested objects have `eventType` strings as keys
	 * and values are streams you created.
	 * @return {Object} fake DOM source object, with an API containing `select()`
	 * and `events()` and `elements()` which can be used just like the DOM Driver's
	 * DOMSource.
	 *
	 * @function mockDOMSource
	 */
	var mockDOMSource_1 = __webpack_require__(102);
	exports.mockDOMSource = mockDOMSource_1.mockDOMSource;
	exports.MockedDOMSource = mockDOMSource_1.MockedDOMSource;
	/**
	 * The hyperscript function `h()` is a function to create virtual DOM objects,
	 * also known as VNodes. Call
	 *
	 * ```js
	 * h('div.myClass', {style: {color: 'red'}}, [])
	 * ```
	 *
	 * to create a VNode that represents a `DIV` element with className `myClass`,
	 * styled with red color, and no children because the `[]` array was passed. The
	 * API is `h(tagOrSelector, optionalData, optionalChildrenOrText)`.
	 *
	 * However, usually you should use "hyperscript helpers", which are shortcut
	 * functions based on hyperscript. There is one hyperscript helper function for
	 * each DOM tagName, such as `h1()`, `h2()`, `div()`, `span()`, `label()`,
	 * `input()`. For instance, the previous example could have been written
	 * as:
	 *
	 * ```js
	 * div('.myClass', {style: {color: 'red'}}, [])
	 * ```
	 *
	 * There are also SVG helper functions, which apply the appropriate SVG
	 * namespace to the resulting elements. `svg()` function creates the top-most
	 * SVG element, and `svg.g`, `svg.polygon`, `svg.circle`, `svg.path` are for
	 * SVG-specific child elements. Example:
	 *
	 * ```js
	 * svg({attrs: {width: 150, height: 150}}, [
	 *   svg.polygon({
	 *     attrs: {
	 *       class: 'triangle',
	 *       points: '20 0 20 150 150 20'
	 *     }
	 *   })
	 * ])
	 * ```
	 *
	 * @function h
	 */
	var h_1 = __webpack_require__(11);
	exports.h = h_1.h;
	var hyperscript_helpers_1 = __webpack_require__(103);
	exports.svg = hyperscript_helpers_1.default.svg;
	exports.a = hyperscript_helpers_1.default.a;
	exports.abbr = hyperscript_helpers_1.default.abbr;
	exports.address = hyperscript_helpers_1.default.address;
	exports.area = hyperscript_helpers_1.default.area;
	exports.article = hyperscript_helpers_1.default.article;
	exports.aside = hyperscript_helpers_1.default.aside;
	exports.audio = hyperscript_helpers_1.default.audio;
	exports.b = hyperscript_helpers_1.default.b;
	exports.base = hyperscript_helpers_1.default.base;
	exports.bdi = hyperscript_helpers_1.default.bdi;
	exports.bdo = hyperscript_helpers_1.default.bdo;
	exports.blockquote = hyperscript_helpers_1.default.blockquote;
	exports.body = hyperscript_helpers_1.default.body;
	exports.br = hyperscript_helpers_1.default.br;
	exports.button = hyperscript_helpers_1.default.button;
	exports.canvas = hyperscript_helpers_1.default.canvas;
	exports.caption = hyperscript_helpers_1.default.caption;
	exports.cite = hyperscript_helpers_1.default.cite;
	exports.code = hyperscript_helpers_1.default.code;
	exports.col = hyperscript_helpers_1.default.col;
	exports.colgroup = hyperscript_helpers_1.default.colgroup;
	exports.dd = hyperscript_helpers_1.default.dd;
	exports.del = hyperscript_helpers_1.default.del;
	exports.dfn = hyperscript_helpers_1.default.dfn;
	exports.dir = hyperscript_helpers_1.default.dir;
	exports.div = hyperscript_helpers_1.default.div;
	exports.dl = hyperscript_helpers_1.default.dl;
	exports.dt = hyperscript_helpers_1.default.dt;
	exports.em = hyperscript_helpers_1.default.em;
	exports.embed = hyperscript_helpers_1.default.embed;
	exports.fieldset = hyperscript_helpers_1.default.fieldset;
	exports.figcaption = hyperscript_helpers_1.default.figcaption;
	exports.figure = hyperscript_helpers_1.default.figure;
	exports.footer = hyperscript_helpers_1.default.footer;
	exports.form = hyperscript_helpers_1.default.form;
	exports.h1 = hyperscript_helpers_1.default.h1;
	exports.h2 = hyperscript_helpers_1.default.h2;
	exports.h3 = hyperscript_helpers_1.default.h3;
	exports.h4 = hyperscript_helpers_1.default.h4;
	exports.h5 = hyperscript_helpers_1.default.h5;
	exports.h6 = hyperscript_helpers_1.default.h6;
	exports.head = hyperscript_helpers_1.default.head;
	exports.header = hyperscript_helpers_1.default.header;
	exports.hgroup = hyperscript_helpers_1.default.hgroup;
	exports.hr = hyperscript_helpers_1.default.hr;
	exports.html = hyperscript_helpers_1.default.html;
	exports.i = hyperscript_helpers_1.default.i;
	exports.iframe = hyperscript_helpers_1.default.iframe;
	exports.img = hyperscript_helpers_1.default.img;
	exports.input = hyperscript_helpers_1.default.input;
	exports.ins = hyperscript_helpers_1.default.ins;
	exports.kbd = hyperscript_helpers_1.default.kbd;
	exports.keygen = hyperscript_helpers_1.default.keygen;
	exports.label = hyperscript_helpers_1.default.label;
	exports.legend = hyperscript_helpers_1.default.legend;
	exports.li = hyperscript_helpers_1.default.li;
	exports.link = hyperscript_helpers_1.default.link;
	exports.main = hyperscript_helpers_1.default.main;
	exports.map = hyperscript_helpers_1.default.map;
	exports.mark = hyperscript_helpers_1.default.mark;
	exports.menu = hyperscript_helpers_1.default.menu;
	exports.meta = hyperscript_helpers_1.default.meta;
	exports.nav = hyperscript_helpers_1.default.nav;
	exports.noscript = hyperscript_helpers_1.default.noscript;
	exports.object = hyperscript_helpers_1.default.object;
	exports.ol = hyperscript_helpers_1.default.ol;
	exports.optgroup = hyperscript_helpers_1.default.optgroup;
	exports.option = hyperscript_helpers_1.default.option;
	exports.p = hyperscript_helpers_1.default.p;
	exports.param = hyperscript_helpers_1.default.param;
	exports.pre = hyperscript_helpers_1.default.pre;
	exports.progress = hyperscript_helpers_1.default.progress;
	exports.q = hyperscript_helpers_1.default.q;
	exports.rp = hyperscript_helpers_1.default.rp;
	exports.rt = hyperscript_helpers_1.default.rt;
	exports.ruby = hyperscript_helpers_1.default.ruby;
	exports.s = hyperscript_helpers_1.default.s;
	exports.samp = hyperscript_helpers_1.default.samp;
	exports.script = hyperscript_helpers_1.default.script;
	exports.section = hyperscript_helpers_1.default.section;
	exports.select = hyperscript_helpers_1.default.select;
	exports.small = hyperscript_helpers_1.default.small;
	exports.source = hyperscript_helpers_1.default.source;
	exports.span = hyperscript_helpers_1.default.span;
	exports.strong = hyperscript_helpers_1.default.strong;
	exports.style = hyperscript_helpers_1.default.style;
	exports.sub = hyperscript_helpers_1.default.sub;
	exports.sup = hyperscript_helpers_1.default.sup;
	exports.table = hyperscript_helpers_1.default.table;
	exports.tbody = hyperscript_helpers_1.default.tbody;
	exports.td = hyperscript_helpers_1.default.td;
	exports.textarea = hyperscript_helpers_1.default.textarea;
	exports.tfoot = hyperscript_helpers_1.default.tfoot;
	exports.th = hyperscript_helpers_1.default.th;
	exports.thead = hyperscript_helpers_1.default.thead;
	exports.title = hyperscript_helpers_1.default.title;
	exports.tr = hyperscript_helpers_1.default.tr;
	exports.u = hyperscript_helpers_1.default.u;
	exports.ul = hyperscript_helpers_1.default.ul;
	exports.video = hyperscript_helpers_1.default.video;
	//# sourceMappingURL=index.js.map

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var h_1 = __webpack_require__(11);
	function copyToThunk(vnode, thunkVNode) {
	    thunkVNode.elm = vnode.elm;
	    vnode.data.fn = thunkVNode.data.fn;
	    vnode.data.args = thunkVNode.data.args;
	    vnode.data.isolate = thunkVNode.data.isolate;
	    thunkVNode.data = vnode.data;
	    thunkVNode.children = vnode.children;
	    thunkVNode.text = vnode.text;
	    thunkVNode.elm = vnode.elm;
	}
	function init(thunkVNode) {
	    var cur = thunkVNode.data;
	    var vnode = cur.fn.apply(undefined, cur.args);
	    copyToThunk(vnode, thunkVNode);
	}
	function prepatch(oldVnode, thunkVNode) {
	    var old = oldVnode.data, cur = thunkVNode.data;
	    var i;
	    var oldArgs = old.args, args = cur.args;
	    if (old.fn !== cur.fn || oldArgs.length !== args.length) {
	        copyToThunk(cur.fn.apply(undefined, args), thunkVNode);
	    }
	    for (i = 0; i < args.length; ++i) {
	        if (oldArgs[i] !== args[i]) {
	            copyToThunk(cur.fn.apply(undefined, args), thunkVNode);
	            return;
	        }
	    }
	    copyToThunk(oldVnode, thunkVNode);
	}
	function thunk(sel, key, fn, args) {
	    if (args === undefined) {
	        args = fn;
	        fn = key;
	        key = undefined;
	    }
	    return h_1.h(sel, {
	        key: key,
	        hook: { init: init, prepatch: prepatch },
	        fn: fn,
	        args: args,
	    });
	}
	exports.thunk = thunk;
	exports.default = thunk;
	//# sourceMappingURL=thunk.js.map

/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var vnode_1 = __webpack_require__(12);
	var is = __webpack_require__(13);
	function addNS(data, children, sel) {
	    data.ns = 'http://www.w3.org/2000/svg';
	    if (sel !== 'foreignObject' && children !== undefined) {
	        for (var i = 0; i < children.length; ++i) {
	            var childData = children[i].data;
	            if (childData !== undefined) {
	                addNS(childData, children[i].children, children[i].sel);
	            }
	        }
	    }
	}
	function h(sel, b, c) {
	    var data = {}, children, text, i;
	    if (c !== undefined) {
	        data = b;
	        if (is.array(c)) {
	            children = c;
	        }
	        else if (is.primitive(c)) {
	            text = c;
	        }
	        else if (c && c.sel) {
	            children = [c];
	        }
	    }
	    else if (b !== undefined) {
	        if (is.array(b)) {
	            children = b;
	        }
	        else if (is.primitive(b)) {
	            text = b;
	        }
	        else if (b && b.sel) {
	            children = [b];
	        }
	        else {
	            data = b;
	        }
	    }
	    if (is.array(children)) {
	        for (i = 0; i < children.length; ++i) {
	            if (is.primitive(children[i]))
	                children[i] = vnode_1.vnode(undefined, undefined, undefined, children[i]);
	        }
	    }
	    if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g' &&
	        (sel.length === 3 || sel[3] === '.' || sel[3] === '#')) {
	        addNS(data, children, sel);
	    }
	    return vnode_1.vnode(sel, data, children, text, undefined);
	}
	exports.h = h;
	;
	exports.default = h;
	//# sourceMappingURL=h.js.map

/***/ }),
/* 12 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function vnode(sel, data, children, text, elm) {
	    var key = data === undefined ? undefined : data.key;
	    return { sel: sel, data: data, children: children,
	        text: text, elm: elm, key: key };
	}
	exports.vnode = vnode;
	exports.default = vnode;
	//# sourceMappingURL=vnode.js.map

/***/ }),
/* 13 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.array = Array.isArray;
	function primitive(s) {
	    return typeof s === 'string' || typeof s === 'number';
	}
	exports.primitive = primitive;
	//# sourceMappingURL=is.js.map

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var adapt_1 = __webpack_require__(15);
	var DocumentDOMSource_1 = __webpack_require__(16);
	var BodyDOMSource_1 = __webpack_require__(18);
	var ElementFinder_1 = __webpack_require__(19);
	var fromEvent_1 = __webpack_require__(17);
	var isolate_1 = __webpack_require__(23);
	var EventDelegator_1 = __webpack_require__(24);
	var utils_1 = __webpack_require__(21);
	var eventTypesThatDontBubble = [
	    "blur",
	    "canplay",
	    "canplaythrough",
	    "change",
	    "durationchange",
	    "emptied",
	    "ended",
	    "focus",
	    "load",
	    "loadeddata",
	    "loadedmetadata",
	    "mouseenter",
	    "mouseleave",
	    "pause",
	    "play",
	    "playing",
	    "ratechange",
	    "reset",
	    "scroll",
	    "seeked",
	    "seeking",
	    "stalled",
	    "submit",
	    "suspend",
	    "timeupdate",
	    "unload",
	    "volumechange",
	    "waiting",
	];
	function determineUseCapture(eventType, options) {
	    var result = false;
	    if (typeof options.useCapture === 'boolean') {
	        result = options.useCapture;
	    }
	    if (eventTypesThatDontBubble.indexOf(eventType) !== -1) {
	        result = true;
	    }
	    return result;
	}
	function filterBasedOnIsolation(domSource, fullScope) {
	    return function filterBasedOnIsolationOperator(rootElement$) {
	        var initialState = {
	            wasIsolated: false,
	            shouldPass: false,
	            element: null,
	        };
	        return rootElement$
	            .fold(function checkIfShouldPass(state, element) {
	            var isIsolated = !!domSource._isolateModule.getElement(fullScope);
	            state.shouldPass = isIsolated && !state.wasIsolated;
	            state.wasIsolated = isIsolated;
	            state.element = element;
	            return state;
	        }, initialState)
	            .drop(1)
	            .filter(function (s) { return s.shouldPass; })
	            .map(function (s) { return s.element; });
	    };
	}
	var MainDOMSource = (function () {
	    function MainDOMSource(_rootElement$, _sanitation$, _namespace, _isolateModule, _delegators, _name) {
	        if (_namespace === void 0) { _namespace = []; }
	        var _this = this;
	        this._rootElement$ = _rootElement$;
	        this._sanitation$ = _sanitation$;
	        this._namespace = _namespace;
	        this._isolateModule = _isolateModule;
	        this._delegators = _delegators;
	        this._name = _name;
	        this.isolateSource = isolate_1.isolateSource;
	        this.isolateSink = function (sink, scope) {
	            if (scope === ':root') {
	                return sink;
	            }
	            else if (utils_1.isClassOrId(scope)) {
	                return isolate_1.siblingIsolateSink(sink, scope);
	            }
	            else {
	                var prevFullScope = utils_1.getFullScope(_this._namespace);
	                var nextFullScope = [prevFullScope, scope].filter(function (x) { return !!x; }).join('-');
	                return isolate_1.totalIsolateSink(sink, nextFullScope);
	            }
	        };
	    }
	    MainDOMSource.prototype.elements = function () {
	        var output$;
	        if (this._namespace.length === 0) {
	            output$ = this._rootElement$;
	        }
	        else {
	            var elementFinder_1 = new ElementFinder_1.ElementFinder(this._namespace, this._isolateModule);
	            output$ = this._rootElement$.map(function (el) { return elementFinder_1.call(el); });
	        }
	        var out = adapt_1.adapt(output$.remember());
	        out._isCycleSource = this._name;
	        return out;
	    };
	    Object.defineProperty(MainDOMSource.prototype, "namespace", {
	        get: function () {
	            return this._namespace;
	        },
	        enumerable: true,
	        configurable: true
	    });
	    MainDOMSource.prototype.select = function (selector) {
	        if (typeof selector !== 'string') {
	            throw new Error("DOM driver's select() expects the argument to be a " +
	                "string as a CSS selector");
	        }
	        if (selector === 'document') {
	            return new DocumentDOMSource_1.DocumentDOMSource(this._name);
	        }
	        if (selector === 'body') {
	            return new BodyDOMSource_1.BodyDOMSource(this._name);
	        }
	        var trimmedSelector = selector.trim();
	        var childNamespace = trimmedSelector === ":root"
	            ? this._namespace
	            : this._namespace.concat(trimmedSelector);
	        return new MainDOMSource(this._rootElement$, this._sanitation$, childNamespace, this._isolateModule, this._delegators, this._name);
	    };
	    MainDOMSource.prototype.events = function (eventType, options) {
	        if (options === void 0) { options = {}; }
	        if (typeof eventType !== "string") {
	            throw new Error("DOM driver's events() expects argument to be a " +
	                "string representing the event type to listen for.");
	        }
	        var useCapture = determineUseCapture(eventType, options);
	        var namespace = this._namespace;
	        var fullScope = utils_1.getFullScope(namespace);
	        var keyParts = [eventType, useCapture];
	        if (fullScope) {
	            keyParts.push(fullScope);
	        }
	        var key = keyParts.join('~');
	        var domSource = this;
	        var rootElement$;
	        if (fullScope) {
	            rootElement$ = this._rootElement$.compose(filterBasedOnIsolation(domSource, fullScope));
	        }
	        else {
	            rootElement$ = this._rootElement$.take(2);
	        }
	        var event$ = rootElement$
	            .map(function setupEventDelegatorOnTopElement(rootElement) {
	            // Event listener just for the root element
	            if (!namespace || namespace.length === 0) {
	                return fromEvent_1.fromEvent(rootElement, eventType, useCapture, options.preventDefault);
	            }
	            // Event listener on the origin element as an EventDelegator
	            var delegators = domSource._delegators;
	            var origin = domSource._isolateModule.getElement(fullScope) || rootElement;
	            var delegator;
	            if (delegators.has(key)) {
	                delegator = delegators.get(key);
	                delegator.updateOrigin(origin);
	            }
	            else {
	                delegator = new EventDelegator_1.EventDelegator(origin, eventType, useCapture, domSource._isolateModule, options.preventDefault);
	                delegators.set(key, delegator);
	            }
	            if (fullScope) {
	                domSource._isolateModule.addEventDelegator(fullScope, delegator);
	            }
	            var subject = delegator.createDestination(namespace);
	            return subject;
	        })
	            .flatten();
	        var out = adapt_1.adapt(event$);
	        out._isCycleSource = domSource._name;
	        return out;
	    };
	    MainDOMSource.prototype.dispose = function () {
	        this._sanitation$.shamefullySendNext(null);
	        this._isolateModule.reset();
	    };
	    return MainDOMSource;
	}());
	exports.MainDOMSource = MainDOMSource;
	//# sourceMappingURL=MainDOMSource.js.map

/***/ }),
/* 15 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function getGlobal() {
	    var globalObj;
	    if (typeof window !== 'undefined') {
	        globalObj = window;
	    }
	    else if (typeof global !== 'undefined') {
	        globalObj = global;
	    }
	    else {
	        globalObj = this;
	    }
	    globalObj.Cyclejs = globalObj.Cyclejs || {};
	    globalObj = globalObj.Cyclejs;
	    globalObj.adaptStream = globalObj.adaptStream || (function (x) { return x; });
	    return globalObj;
	}
	function setAdapt(f) {
	    getGlobal().adaptStream = f;
	}
	exports.setAdapt = setAdapt;
	function adapt(stream) {
	    return getGlobal().adaptStream(stream);
	}
	exports.adapt = adapt;
	//# sourceMappingURL=adapt.js.map
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var xstream_1 = __webpack_require__(3);
	var adapt_1 = __webpack_require__(15);
	var fromEvent_1 = __webpack_require__(17);
	var DocumentDOMSource = (function () {
	    function DocumentDOMSource(_name) {
	        this._name = _name;
	    }
	    DocumentDOMSource.prototype.select = function (selector) {
	        // This functionality is still undefined/undecided.
	        return this;
	    };
	    DocumentDOMSource.prototype.elements = function () {
	        var out = adapt_1.adapt(xstream_1.default.of(document));
	        out._isCycleSource = this._name;
	        return out;
	    };
	    DocumentDOMSource.prototype.events = function (eventType, options) {
	        if (options === void 0) { options = {}; }
	        var stream;
	        stream = fromEvent_1.fromEvent(document, eventType, options.useCapture, options.preventDefault);
	        var out = adapt_1.adapt(stream);
	        out._isCycleSource = this._name;
	        return out;
	    };
	    return DocumentDOMSource;
	}());
	exports.DocumentDOMSource = DocumentDOMSource;
	//# sourceMappingURL=DocumentDOMSource.js.map

/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var xstream_1 = __webpack_require__(3);
	function fromEvent(element, eventName, useCapture, preventDefault) {
	    if (useCapture === void 0) { useCapture = false; }
	    if (preventDefault === void 0) { preventDefault = false; }
	    return xstream_1.Stream.create({
	        element: element,
	        next: null,
	        start: function start(listener) {
	            if (preventDefault) {
	                this.next = function next(event) {
	                    event.preventDefault();
	                    listener.next(event);
	                };
	            }
	            else {
	                this.next = function next(event) {
	                    listener.next(event);
	                };
	            }
	            this.element.addEventListener(eventName, this.next, useCapture);
	        },
	        stop: function stop() {
	            this.element.removeEventListener(eventName, this.next, useCapture);
	        },
	    });
	}
	exports.fromEvent = fromEvent;
	//# sourceMappingURL=fromEvent.js.map

/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var xstream_1 = __webpack_require__(3);
	var adapt_1 = __webpack_require__(15);
	var fromEvent_1 = __webpack_require__(17);
	var BodyDOMSource = (function () {
	    function BodyDOMSource(_name) {
	        this._name = _name;
	    }
	    BodyDOMSource.prototype.select = function (selector) {
	        // This functionality is still undefined/undecided.
	        return this;
	    };
	    BodyDOMSource.prototype.elements = function () {
	        var out = adapt_1.adapt(xstream_1.default.of(document.body));
	        out._isCycleSource = this._name;
	        return out;
	    };
	    BodyDOMSource.prototype.events = function (eventType, options) {
	        if (options === void 0) { options = {}; }
	        var stream;
	        stream = fromEvent_1.fromEvent(document.body, eventType, options.useCapture, options.preventDefault);
	        var out = adapt_1.adapt(stream);
	        out._isCycleSource = this._name;
	        return out;
	    };
	    return BodyDOMSource;
	}());
	exports.BodyDOMSource = BodyDOMSource;
	//# sourceMappingURL=BodyDOMSource.js.map

/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var ScopeChecker_1 = __webpack_require__(20);
	var utils_1 = __webpack_require__(21);
	var matchesSelector_1 = __webpack_require__(22);
	function toElArray(input) {
	    return Array.prototype.slice.call(input);
	}
	var ElementFinder = (function () {
	    function ElementFinder(namespace, isolateModule) {
	        this.namespace = namespace;
	        this.isolateModule = isolateModule;
	    }
	    ElementFinder.prototype.call = function (rootElement) {
	        var namespace = this.namespace;
	        var selector = utils_1.getSelectors(namespace);
	        if (!selector) {
	            return rootElement;
	        }
	        var fullScope = utils_1.getFullScope(namespace);
	        var scopeChecker = new ScopeChecker_1.ScopeChecker(fullScope, this.isolateModule);
	        var topNode = fullScope
	            ? this.isolateModule.getElement(fullScope) || rootElement
	            : rootElement;
	        var topNodeMatchesSelector = !!fullScope && !!selector && matchesSelector_1.matchesSelector(topNode, selector);
	        return toElArray(topNode.querySelectorAll(selector))
	            .filter(scopeChecker.isDirectlyInScope, scopeChecker)
	            .concat(topNodeMatchesSelector ? [topNode] : []);
	    };
	    return ElementFinder;
	}());
	exports.ElementFinder = ElementFinder;
	//# sourceMappingURL=ElementFinder.js.map

/***/ }),
/* 20 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var ScopeChecker = (function () {
	    function ScopeChecker(fullScope, isolateModule) {
	        this.fullScope = fullScope;
	        this.isolateModule = isolateModule;
	    }
	    /**
	     * Checks whether the given element is *directly* in the scope of this
	     * scope checker. Being contained *indirectly* through other scopes
	     * is not valid. This is crucial for implementing parent-child isolation,
	     * so that the parent selectors don't search inside a child scope.
	     */
	    ScopeChecker.prototype.isDirectlyInScope = function (leaf) {
	        for (var el = leaf; el; el = el.parentElement) {
	            var fullScope = this.isolateModule.getFullScope(el);
	            if (fullScope && fullScope !== this.fullScope) {
	                return false;
	            }
	            if (fullScope) {
	                return true;
	            }
	        }
	        return true;
	    };
	    return ScopeChecker;
	}());
	exports.ScopeChecker = ScopeChecker;
	//# sourceMappingURL=ScopeChecker.js.map

/***/ }),
/* 21 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function isValidNode(obj) {
	    var ELEM_TYPE = 1;
	    var FRAG_TYPE = 11;
	    return typeof HTMLElement === 'object'
	        ? obj instanceof HTMLElement || obj instanceof DocumentFragment
	        : obj &&
	            typeof obj === 'object' &&
	            obj !== null &&
	            (obj.nodeType === ELEM_TYPE || obj.nodeType === FRAG_TYPE) &&
	            typeof obj.nodeName === 'string';
	}
	function isClassOrId(str) {
	    return str.length > 1 && (str[0] === '.' || str[0] === '#');
	}
	exports.isClassOrId = isClassOrId;
	function isDocFrag(el) {
	    return el.nodeType === 11;
	}
	exports.isDocFrag = isDocFrag;
	exports.SCOPE_PREFIX = '$$CYCLEDOM$$-';
	function getValidNode(selectors) {
	    var domElement = typeof selectors === 'string'
	        ? document.querySelector(selectors)
	        : selectors;
	    if (typeof selectors === 'string' && domElement === null) {
	        throw new Error("Cannot render into unknown element `" + selectors + "`");
	    }
	    else if (!isValidNode(domElement)) {
	        throw new Error('Given container is not a DOM element neither a ' + 'selector string.');
	    }
	    return domElement;
	}
	exports.getValidNode = getValidNode;
	/**
	 * The full scope of a namespace is the "absolute path" of scopes from
	 * parent to child. This is extracted from the namespace, filter only for
	 * scopes in the namespace.
	 */
	function getFullScope(namespace) {
	    return namespace
	        .filter(function (c) { return c.indexOf(exports.SCOPE_PREFIX) > -1; })
	        .map(function (c) { return c.replace(exports.SCOPE_PREFIX, ''); })
	        .join('-');
	}
	exports.getFullScope = getFullScope;
	function getSelectors(namespace) {
	    return namespace.filter(function (c) { return c.indexOf(exports.SCOPE_PREFIX) === -1; }).join(' ');
	}
	exports.getSelectors = getSelectors;
	//# sourceMappingURL=utils.js.map

/***/ }),
/* 22 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function createMatchesSelector() {
	    var vendor;
	    try {
	        var proto = Element.prototype;
	        vendor =
	            proto.matches ||
	                proto.matchesSelector ||
	                proto.webkitMatchesSelector ||
	                proto.mozMatchesSelector ||
	                proto.msMatchesSelector ||
	                proto.oMatchesSelector;
	    }
	    catch (err) {
	        vendor = null;
	    }
	    return function match(elem, selector) {
	        if (selector.length === 0) {
	            return true;
	        }
	        if (vendor) {
	            return vendor.call(elem, selector);
	        }
	        var nodes = elem.parentNode.querySelectorAll(selector);
	        for (var i = 0; i < nodes.length; i++) {
	            if (nodes[i] === elem) {
	                return true;
	            }
	        }
	        return false;
	    };
	}
	exports.matchesSelector = createMatchesSelector();
	//# sourceMappingURL=matchesSelector.js.map

/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var vnode_1 = __webpack_require__(12);
	var utils_1 = __webpack_require__(21);
	function totalIsolateSource(source, scope) {
	    return source.select(utils_1.SCOPE_PREFIX + scope);
	}
	function siblingIsolateSource(source, scope) {
	    return source.select(scope);
	}
	function isolateSource(source, scope) {
	    if (scope === ':root') {
	        return source;
	    }
	    else if (utils_1.isClassOrId(scope)) {
	        return siblingIsolateSource(source, scope);
	    }
	    else {
	        return totalIsolateSource(source, scope);
	    }
	}
	exports.isolateSource = isolateSource;
	function siblingIsolateSink(sink, scope) {
	    return sink.map(function (node) {
	        return node
	            ? vnode_1.vnode(node.sel + scope, node.data, node.children, node.text, node.elm)
	            : node;
	    });
	}
	exports.siblingIsolateSink = siblingIsolateSink;
	function totalIsolateSink(sink, fullScope) {
	    return sink.map(function (node) {
	        if (!node) {
	            return node;
	        }
	        // Ignore if already had up-to-date full scope in vnode.data.isolate
	        if (node.data && node.data.isolate) {
	            var isolateData = node.data.isolate;
	            var prevFullScopeNum = isolateData.replace(/(cycle|\-)/g, '');
	            var fullScopeNum = fullScope.replace(/(cycle|\-)/g, '');
	            if (isNaN(parseInt(prevFullScopeNum)) ||
	                isNaN(parseInt(fullScopeNum)) ||
	                prevFullScopeNum > fullScopeNum) {
	                // > is lexicographic string comparison
	                return node;
	            }
	        }
	        // Insert up-to-date full scope in vnode.data.isolate, and also a key if needed
	        node.data = node.data || {};
	        node.data.isolate = fullScope;
	        if (typeof node.key === 'undefined') {
	            node.key = utils_1.SCOPE_PREFIX + fullScope;
	        }
	        return node;
	    });
	}
	exports.totalIsolateSink = totalIsolateSink;
	//# sourceMappingURL=isolate.js.map

/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var xstream_1 = __webpack_require__(3);
	var ScopeChecker_1 = __webpack_require__(20);
	var utils_1 = __webpack_require__(21);
	var matchesSelector_1 = __webpack_require__(22);
	/**
	 * Finds (with binary search) index of the destination that id equal to searchId
	 * among the destinations in the given array.
	 */
	function indexOf(arr, searchId) {
	    var minIndex = 0;
	    var maxIndex = arr.length - 1;
	    var currentIndex;
	    var current;
	    while (minIndex <= maxIndex) {
	        currentIndex = ((minIndex + maxIndex) / 2) | 0; // tslint:disable-line:no-bitwise
	        current = arr[currentIndex];
	        var currentId = current.id;
	        if (currentId < searchId) {
	            minIndex = currentIndex + 1;
	        }
	        else if (currentId > searchId) {
	            maxIndex = currentIndex - 1;
	        }
	        else {
	            return currentIndex;
	        }
	    }
	    return -1;
	}
	/**
	 * Manages "Event delegation", by connecting an origin with multiple
	 * destinations.
	 *
	 * Attaches a DOM event listener to the DOM element called the "origin",
	 * and delegates events to "destinations", which are subjects as outputs
	 * for the DOMSource. Simulates bubbling or capturing, with regards to
	 * isolation boundaries too.
	 */
	var EventDelegator = (function () {
	    function EventDelegator(origin, eventType, useCapture, isolateModule, preventDefault) {
	        if (preventDefault === void 0) { preventDefault = false; }
	        var _this = this;
	        this.origin = origin;
	        this.eventType = eventType;
	        this.useCapture = useCapture;
	        this.isolateModule = isolateModule;
	        this.preventDefault = preventDefault;
	        this.destinations = [];
	        this._lastId = 0;
	        if (preventDefault) {
	            if (useCapture) {
	                this.listener = function (ev) {
	                    ev.preventDefault();
	                    _this.capture(ev);
	                };
	            }
	            else {
	                this.listener = function (ev) {
	                    ev.preventDefault();
	                    _this.bubble(ev);
	                };
	            }
	        }
	        else {
	            if (useCapture) {
	                this.listener = function (ev) { return _this.capture(ev); };
	            }
	            else {
	                this.listener = function (ev) { return _this.bubble(ev); };
	            }
	        }
	        origin.addEventListener(eventType, this.listener, useCapture);
	    }
	    EventDelegator.prototype.updateOrigin = function (newOrigin) {
	        this.origin.removeEventListener(this.eventType, this.listener, this.useCapture);
	        newOrigin.addEventListener(this.eventType, this.listener, this.useCapture);
	        this.origin = newOrigin;
	    };
	    /**
	     * Creates a *new* destination given the namespace and returns the subject
	     * representing the destination of events. Is not referentially transparent,
	     * will always return a different output for the same input.
	     */
	    EventDelegator.prototype.createDestination = function (namespace) {
	        var _this = this;
	        var id = this._lastId++;
	        var selector = utils_1.getSelectors(namespace);
	        var scopeChecker = new ScopeChecker_1.ScopeChecker(utils_1.getFullScope(namespace), this.isolateModule);
	        var subject = xstream_1.default.create({
	            start: function () { },
	            stop: function () {
	                if ('requestIdleCallback' in window) {
	                    requestIdleCallback(function () {
	                        _this.removeDestination(id);
	                    });
	                }
	                else {
	                    _this.removeDestination(id);
	                }
	            },
	        });
	        var destination = { id: id, selector: selector, scopeChecker: scopeChecker, subject: subject };
	        this.destinations.push(destination);
	        return subject;
	    };
	    /**
	     * Removes the destination that has the given id.
	     */
	    EventDelegator.prototype.removeDestination = function (id) {
	        var i = indexOf(this.destinations, id);
	        i >= 0 && this.destinations.splice(i, 1); // tslint:disable-line:no-unused-expression
	    };
	    EventDelegator.prototype.capture = function (ev) {
	        var n = this.destinations.length;
	        for (var i = 0; i < n; i++) {
	            var dest = this.destinations[i];
	            if (matchesSelector_1.matchesSelector(ev.target, dest.selector)) {
	                dest.subject._n(ev);
	            }
	        }
	    };
	    EventDelegator.prototype.bubble = function (rawEvent) {
	        var origin = this.origin;
	        if (!origin.contains(rawEvent.currentTarget)) {
	            return;
	        }
	        var roof = origin.parentElement;
	        var ev = this.patchEvent(rawEvent);
	        for (var el = ev.target; el && el !== roof; el = el.parentElement) {
	            if (!origin.contains(el)) {
	                ev.stopPropagation();
	            }
	            if (ev.propagationHasBeenStopped) {
	                return;
	            }
	            this.matchEventAgainstDestinations(el, ev);
	        }
	    };
	    EventDelegator.prototype.patchEvent = function (event) {
	        var pEvent = event;
	        pEvent.propagationHasBeenStopped = false;
	        var oldStopPropagation = pEvent.stopPropagation;
	        pEvent.stopPropagation = function stopPropagation() {
	            oldStopPropagation.call(this);
	            this.propagationHasBeenStopped = true;
	        };
	        return pEvent;
	    };
	    EventDelegator.prototype.matchEventAgainstDestinations = function (el, ev) {
	        var n = this.destinations.length;
	        for (var i = 0; i < n; i++) {
	            var dest = this.destinations[i];
	            if (!dest.scopeChecker.isDirectlyInScope(el)) {
	                continue;
	            }
	            if (matchesSelector_1.matchesSelector(el, dest.selector)) {
	                this.mutateEventCurrentTarget(ev, el);
	                dest.subject._n(ev);
	            }
	        }
	    };
	    EventDelegator.prototype.mutateEventCurrentTarget = function (event, currentTargetElement) {
	        try {
	            Object.defineProperty(event, "currentTarget", {
	                value: currentTargetElement,
	                configurable: true,
	            });
	        }
	        catch (err) {
	            console.log("please use event.ownerTarget");
	        }
	        event.ownerTarget = currentTargetElement;
	    };
	    return EventDelegator;
	}());
	exports.EventDelegator = EventDelegator;
	//# sourceMappingURL=EventDelegator.js.map

/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var snabbdom_1 = __webpack_require__(26);
	var xstream_1 = __webpack_require__(3);
	var MainDOMSource_1 = __webpack_require__(14);
	var tovnode_1 = __webpack_require__(29);
	var VNodeWrapper_1 = __webpack_require__(30);
	var utils_1 = __webpack_require__(21);
	var modules_1 = __webpack_require__(33);
	var IsolateModule_1 = __webpack_require__(39);
	var MapPolyfill = __webpack_require__(40);
	function makeDOMDriverInputGuard(modules) {
	    if (!Array.isArray(modules)) {
	        throw new Error("Optional modules option must be " + "an array for snabbdom modules");
	    }
	}
	function domDriverInputGuard(view$) {
	    if (!view$ ||
	        typeof view$.addListener !== "function" ||
	        typeof view$.fold !== "function") {
	        throw new Error("The DOM driver function expects as input a Stream of " +
	            "virtual DOM elements");
	    }
	}
	function dropCompletion(input) {
	    return xstream_1.default.merge(input, xstream_1.default.never());
	}
	function unwrapElementFromVNode(vnode) {
	    return vnode.elm;
	}
	function reportSnabbdomError(err) {
	    (console.error || console.log)(err);
	}
	function makeDOMDriver(container, options) {
	    if (!options) {
	        options = {};
	    }
	    var modules = options.modules || modules_1.default;
	    var isolateModule = new IsolateModule_1.IsolateModule();
	    var patch = snabbdom_1.init([isolateModule.createModule()].concat(modules));
	    var rootElement = utils_1.getValidNode(container) || document.body;
	    var vnodeWrapper = new VNodeWrapper_1.VNodeWrapper(rootElement);
	    var delegators = new MapPolyfill();
	    makeDOMDriverInputGuard(modules);
	    function DOMDriver(vnode$, name) {
	        if (name === void 0) { name = 'DOM'; }
	        domDriverInputGuard(vnode$);
	        var sanitation$ = xstream_1.default.create();
	        var rootElement$ = xstream_1.default
	            .merge(vnode$.endWhen(sanitation$), sanitation$)
	            .map(function (vnode) { return vnodeWrapper.call(vnode); })
	            .fold(patch, tovnode_1.toVNode(rootElement))
	            .drop(1)
	            .map(unwrapElementFromVNode)
	            .compose(dropCompletion) // don't complete this stream
	            .startWith(rootElement);
	        // Start the snabbdom patching, over time
	        var listener = { error: reportSnabbdomError };
	        if (document.readyState === 'loading') {
	            document.addEventListener('readystatechange', function () {
	                if (document.readyState === 'interactive') {
	                    rootElement$.addListener(listener);
	                }
	            });
	        }
	        else {
	            rootElement$.addListener(listener);
	        }
	        return new MainDOMSource_1.MainDOMSource(rootElement$, sanitation$, [], isolateModule, delegators, name);
	    }
	    return DOMDriver;
	}
	exports.makeDOMDriver = makeDOMDriver;
	//# sourceMappingURL=makeDOMDriver.js.map

/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var vnode_1 = __webpack_require__(12);
	var is = __webpack_require__(13);
	var htmldomapi_1 = __webpack_require__(27);
	function isUndef(s) { return s === undefined; }
	function isDef(s) { return s !== undefined; }
	var emptyNode = vnode_1.default('', {}, [], undefined, undefined);
	function sameVnode(vnode1, vnode2) {
	    return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
	}
	function isVnode(vnode) {
	    return vnode.sel !== undefined;
	}
	function createKeyToOldIdx(children, beginIdx, endIdx) {
	    var i, map = {}, key, ch;
	    for (i = beginIdx; i <= endIdx; ++i) {
	        ch = children[i];
	        if (ch != null) {
	            key = ch.key;
	            if (key !== undefined)
	                map[key] = i;
	        }
	    }
	    return map;
	}
	var hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];
	var h_1 = __webpack_require__(11);
	exports.h = h_1.h;
	var thunk_1 = __webpack_require__(28);
	exports.thunk = thunk_1.thunk;
	function init(modules, domApi) {
	    var i, j, cbs = {};
	    var api = domApi !== undefined ? domApi : htmldomapi_1.default;
	    for (i = 0; i < hooks.length; ++i) {
	        cbs[hooks[i]] = [];
	        for (j = 0; j < modules.length; ++j) {
	            var hook = modules[j][hooks[i]];
	            if (hook !== undefined) {
	                cbs[hooks[i]].push(hook);
	            }
	        }
	    }
	    function emptyNodeAt(elm) {
	        var id = elm.id ? '#' + elm.id : '';
	        var c = elm.className ? '.' + elm.className.split(' ').join('.') : '';
	        return vnode_1.default(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
	    }
	    function createRmCb(childElm, listeners) {
	        return function rmCb() {
	            if (--listeners === 0) {
	                var parent_1 = api.parentNode(childElm);
	                api.removeChild(parent_1, childElm);
	            }
	        };
	    }
	    function createElm(vnode, insertedVnodeQueue) {
	        var i, data = vnode.data;
	        if (data !== undefined) {
	            if (isDef(i = data.hook) && isDef(i = i.init)) {
	                i(vnode);
	                data = vnode.data;
	            }
	        }
	        var children = vnode.children, sel = vnode.sel;
	        if (sel === '!') {
	            if (isUndef(vnode.text)) {
	                vnode.text = '';
	            }
	            vnode.elm = api.createComment(vnode.text);
	        }
	        else if (sel !== undefined) {
	            // Parse selector
	            var hashIdx = sel.indexOf('#');
	            var dotIdx = sel.indexOf('.', hashIdx);
	            var hash = hashIdx > 0 ? hashIdx : sel.length;
	            var dot = dotIdx > 0 ? dotIdx : sel.length;
	            var tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
	            var elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
	                : api.createElement(tag);
	            if (hash < dot)
	                elm.setAttribute('id', sel.slice(hash + 1, dot));
	            if (dotIdx > 0)
	                elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '));
	            for (i = 0; i < cbs.create.length; ++i)
	                cbs.create[i](emptyNode, vnode);
	            if (is.array(children)) {
	                for (i = 0; i < children.length; ++i) {
	                    var ch = children[i];
	                    if (ch != null) {
	                        api.appendChild(elm, createElm(ch, insertedVnodeQueue));
	                    }
	                }
	            }
	            else if (is.primitive(vnode.text)) {
	                api.appendChild(elm, api.createTextNode(vnode.text));
	            }
	            i = vnode.data.hook; // Reuse variable
	            if (isDef(i)) {
	                if (i.create)
	                    i.create(emptyNode, vnode);
	                if (i.insert)
	                    insertedVnodeQueue.push(vnode);
	            }
	        }
	        else {
	            vnode.elm = api.createTextNode(vnode.text);
	        }
	        return vnode.elm;
	    }
	    function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
	        for (; startIdx <= endIdx; ++startIdx) {
	            var ch = vnodes[startIdx];
	            if (ch != null) {
	                api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
	            }
	        }
	    }
	    function invokeDestroyHook(vnode) {
	        var i, j, data = vnode.data;
	        if (data !== undefined) {
	            if (isDef(i = data.hook) && isDef(i = i.destroy))
	                i(vnode);
	            for (i = 0; i < cbs.destroy.length; ++i)
	                cbs.destroy[i](vnode);
	            if (vnode.children !== undefined) {
	                for (j = 0; j < vnode.children.length; ++j) {
	                    i = vnode.children[j];
	                    if (i != null && typeof i !== "string") {
	                        invokeDestroyHook(i);
	                    }
	                }
	            }
	        }
	    }
	    function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
	        for (; startIdx <= endIdx; ++startIdx) {
	            var i_1 = void 0, listeners = void 0, rm = void 0, ch = vnodes[startIdx];
	            if (ch != null) {
	                if (isDef(ch.sel)) {
	                    invokeDestroyHook(ch);
	                    listeners = cbs.remove.length + 1;
	                    rm = createRmCb(ch.elm, listeners);
	                    for (i_1 = 0; i_1 < cbs.remove.length; ++i_1)
	                        cbs.remove[i_1](ch, rm);
	                    if (isDef(i_1 = ch.data) && isDef(i_1 = i_1.hook) && isDef(i_1 = i_1.remove)) {
	                        i_1(ch, rm);
	                    }
	                    else {
	                        rm();
	                    }
	                }
	                else {
	                    api.removeChild(parentElm, ch.elm);
	                }
	            }
	        }
	    }
	    function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
	        var oldStartIdx = 0, newStartIdx = 0;
	        var oldEndIdx = oldCh.length - 1;
	        var oldStartVnode = oldCh[0];
	        var oldEndVnode = oldCh[oldEndIdx];
	        var newEndIdx = newCh.length - 1;
	        var newStartVnode = newCh[0];
	        var newEndVnode = newCh[newEndIdx];
	        var oldKeyToIdx;
	        var idxInOld;
	        var elmToMove;
	        var before;
	        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
	            if (oldStartVnode == null) {
	                oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
	            }
	            else if (oldEndVnode == null) {
	                oldEndVnode = oldCh[--oldEndIdx];
	            }
	            else if (newStartVnode == null) {
	                newStartVnode = newCh[++newStartIdx];
	            }
	            else if (newEndVnode == null) {
	                newEndVnode = newCh[--newEndIdx];
	            }
	            else if (sameVnode(oldStartVnode, newStartVnode)) {
	                patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
	                oldStartVnode = oldCh[++oldStartIdx];
	                newStartVnode = newCh[++newStartIdx];
	            }
	            else if (sameVnode(oldEndVnode, newEndVnode)) {
	                patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
	                oldEndVnode = oldCh[--oldEndIdx];
	                newEndVnode = newCh[--newEndIdx];
	            }
	            else if (sameVnode(oldStartVnode, newEndVnode)) {
	                patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
	                api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
	                oldStartVnode = oldCh[++oldStartIdx];
	                newEndVnode = newCh[--newEndIdx];
	            }
	            else if (sameVnode(oldEndVnode, newStartVnode)) {
	                patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
	                api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
	                oldEndVnode = oldCh[--oldEndIdx];
	                newStartVnode = newCh[++newStartIdx];
	            }
	            else {
	                if (oldKeyToIdx === undefined) {
	                    oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
	                }
	                idxInOld = oldKeyToIdx[newStartVnode.key];
	                if (isUndef(idxInOld)) {
	                    api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
	                    newStartVnode = newCh[++newStartIdx];
	                }
	                else {
	                    elmToMove = oldCh[idxInOld];
	                    if (elmToMove.sel !== newStartVnode.sel) {
	                        api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
	                    }
	                    else {
	                        patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
	                        oldCh[idxInOld] = undefined;
	                        api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
	                    }
	                    newStartVnode = newCh[++newStartIdx];
	                }
	            }
	        }
	        if (oldStartIdx > oldEndIdx) {
	            before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
	            addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
	        }
	        else if (newStartIdx > newEndIdx) {
	            removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
	        }
	    }
	    function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
	        var i, hook;
	        if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
	            i(oldVnode, vnode);
	        }
	        var elm = vnode.elm = oldVnode.elm;
	        var oldCh = oldVnode.children;
	        var ch = vnode.children;
	        if (oldVnode === vnode)
	            return;
	        if (vnode.data !== undefined) {
	            for (i = 0; i < cbs.update.length; ++i)
	                cbs.update[i](oldVnode, vnode);
	            i = vnode.data.hook;
	            if (isDef(i) && isDef(i = i.update))
	                i(oldVnode, vnode);
	        }
	        if (isUndef(vnode.text)) {
	            if (isDef(oldCh) && isDef(ch)) {
	                if (oldCh !== ch)
	                    updateChildren(elm, oldCh, ch, insertedVnodeQueue);
	            }
	            else if (isDef(ch)) {
	                if (isDef(oldVnode.text))
	                    api.setTextContent(elm, '');
	                addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
	            }
	            else if (isDef(oldCh)) {
	                removeVnodes(elm, oldCh, 0, oldCh.length - 1);
	            }
	            else if (isDef(oldVnode.text)) {
	                api.setTextContent(elm, '');
	            }
	        }
	        else if (oldVnode.text !== vnode.text) {
	            api.setTextContent(elm, vnode.text);
	        }
	        if (isDef(hook) && isDef(i = hook.postpatch)) {
	            i(oldVnode, vnode);
	        }
	    }
	    return function patch(oldVnode, vnode) {
	        var i, elm, parent;
	        var insertedVnodeQueue = [];
	        for (i = 0; i < cbs.pre.length; ++i)
	            cbs.pre[i]();
	        if (!isVnode(oldVnode)) {
	            oldVnode = emptyNodeAt(oldVnode);
	        }
	        if (sameVnode(oldVnode, vnode)) {
	            patchVnode(oldVnode, vnode, insertedVnodeQueue);
	        }
	        else {
	            elm = oldVnode.elm;
	            parent = api.parentNode(elm);
	            createElm(vnode, insertedVnodeQueue);
	            if (parent !== null) {
	                api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
	                removeVnodes(parent, [oldVnode], 0, 0);
	            }
	        }
	        for (i = 0; i < insertedVnodeQueue.length; ++i) {
	            insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
	        }
	        for (i = 0; i < cbs.post.length; ++i)
	            cbs.post[i]();
	        return vnode;
	    };
	}
	exports.init = init;
	//# sourceMappingURL=snabbdom.js.map

/***/ }),
/* 27 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function createElement(tagName) {
	    return document.createElement(tagName);
	}
	function createElementNS(namespaceURI, qualifiedName) {
	    return document.createElementNS(namespaceURI, qualifiedName);
	}
	function createTextNode(text) {
	    return document.createTextNode(text);
	}
	function createComment(text) {
	    return document.createComment(text);
	}
	function insertBefore(parentNode, newNode, referenceNode) {
	    parentNode.insertBefore(newNode, referenceNode);
	}
	function removeChild(node, child) {
	    node.removeChild(child);
	}
	function appendChild(node, child) {
	    node.appendChild(child);
	}
	function parentNode(node) {
	    return node.parentNode;
	}
	function nextSibling(node) {
	    return node.nextSibling;
	}
	function tagName(elm) {
	    return elm.tagName;
	}
	function setTextContent(node, text) {
	    node.textContent = text;
	}
	function getTextContent(node) {
	    return node.textContent;
	}
	function isElement(node) {
	    return node.nodeType === 1;
	}
	function isText(node) {
	    return node.nodeType === 3;
	}
	function isComment(node) {
	    return node.nodeType === 8;
	}
	exports.htmlDomApi = {
	    createElement: createElement,
	    createElementNS: createElementNS,
	    createTextNode: createTextNode,
	    createComment: createComment,
	    insertBefore: insertBefore,
	    removeChild: removeChild,
	    appendChild: appendChild,
	    parentNode: parentNode,
	    nextSibling: nextSibling,
	    tagName: tagName,
	    setTextContent: setTextContent,
	    getTextContent: getTextContent,
	    isElement: isElement,
	    isText: isText,
	    isComment: isComment,
	};
	exports.default = exports.htmlDomApi;
	//# sourceMappingURL=htmldomapi.js.map

/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var h_1 = __webpack_require__(11);
	function copyToThunk(vnode, thunk) {
	    thunk.elm = vnode.elm;
	    vnode.data.fn = thunk.data.fn;
	    vnode.data.args = thunk.data.args;
	    thunk.data = vnode.data;
	    thunk.children = vnode.children;
	    thunk.text = vnode.text;
	    thunk.elm = vnode.elm;
	}
	function init(thunk) {
	    var cur = thunk.data;
	    var vnode = cur.fn.apply(undefined, cur.args);
	    copyToThunk(vnode, thunk);
	}
	function prepatch(oldVnode, thunk) {
	    var i, old = oldVnode.data, cur = thunk.data;
	    var oldArgs = old.args, args = cur.args;
	    if (old.fn !== cur.fn || oldArgs.length !== args.length) {
	        copyToThunk(cur.fn.apply(undefined, args), thunk);
	        return;
	    }
	    for (i = 0; i < args.length; ++i) {
	        if (oldArgs[i] !== args[i]) {
	            copyToThunk(cur.fn.apply(undefined, args), thunk);
	            return;
	        }
	    }
	    copyToThunk(oldVnode, thunk);
	}
	exports.thunk = function thunk(sel, key, fn, args) {
	    if (args === undefined) {
	        args = fn;
	        fn = key;
	        key = undefined;
	    }
	    return h_1.h(sel, {
	        key: key,
	        hook: { init: init, prepatch: prepatch },
	        fn: fn,
	        args: args
	    });
	};
	exports.default = exports.thunk;
	//# sourceMappingURL=thunk.js.map

/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var vnode_1 = __webpack_require__(12);
	var htmldomapi_1 = __webpack_require__(27);
	function toVNode(node, domApi) {
	    var api = domApi !== undefined ? domApi : htmldomapi_1.default;
	    var text;
	    if (api.isElement(node)) {
	        var id = node.id ? '#' + node.id : '';
	        var cn = node.getAttribute('class');
	        var c = cn ? '.' + cn.split(' ').join('.') : '';
	        var sel = api.tagName(node).toLowerCase() + id + c;
	        var attrs = {};
	        var children = [];
	        var name_1;
	        var i = void 0, n = void 0;
	        var elmAttrs = node.attributes;
	        var elmChildren = node.childNodes;
	        for (i = 0, n = elmAttrs.length; i < n; i++) {
	            name_1 = elmAttrs[i].nodeName;
	            if (name_1 !== 'id' && name_1 !== 'class') {
	                attrs[name_1] = elmAttrs[i].nodeValue;
	            }
	        }
	        for (i = 0, n = elmChildren.length; i < n; i++) {
	            children.push(toVNode(elmChildren[i]));
	        }
	        return vnode_1.default(sel, { attrs: attrs }, children, undefined, node);
	    }
	    else if (api.isText(node)) {
	        text = api.getTextContent(node);
	        return vnode_1.default(undefined, undefined, undefined, text, node);
	    }
	    else if (api.isComment(node)) {
	        text = api.getTextContent(node);
	        return vnode_1.default('!', {}, [], text, node);
	    }
	    else {
	        return vnode_1.default('', {}, [], undefined, node);
	    }
	}
	exports.toVNode = toVNode;
	exports.default = toVNode;
	//# sourceMappingURL=tovnode.js.map

/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var vnode_1 = __webpack_require__(12);
	var h_1 = __webpack_require__(11);
	var classNameFromVNode_1 = __webpack_require__(31);
	var selectorParser_1 = __webpack_require__(32);
	var utils_1 = __webpack_require__(21);
	var VNodeWrapper = (function () {
	    function VNodeWrapper(rootElement) {
	        this.rootElement = rootElement;
	    }
	    VNodeWrapper.prototype.call = function (vnode) {
	        if (utils_1.isDocFrag(this.rootElement)) {
	            return this.wrapDocFrag(vnode === null ? [] : [vnode]);
	        }
	        if (vnode === null) {
	            return this.wrap([]);
	        }
	        var _a = selectorParser_1.selectorParser(vnode), selTagName = _a.tagName, selId = _a.id;
	        var vNodeClassName = classNameFromVNode_1.classNameFromVNode(vnode);
	        var vNodeData = vnode.data || {};
	        var vNodeDataProps = vNodeData.props || {};
	        var _b = vNodeDataProps.id, vNodeId = _b === void 0 ? selId : _b;
	        var isVNodeAndRootElementIdentical = typeof vNodeId === 'string' &&
	            vNodeId.toUpperCase() === this.rootElement.id.toUpperCase() &&
	            selTagName.toUpperCase() === this.rootElement.tagName.toUpperCase() &&
	            vNodeClassName.toUpperCase() === this.rootElement.className.toUpperCase();
	        if (isVNodeAndRootElementIdentical) {
	            return vnode;
	        }
	        return this.wrap([vnode]);
	    };
	    VNodeWrapper.prototype.wrapDocFrag = function (children) {
	        return vnode_1.vnode('', {}, children, undefined, this.rootElement);
	    };
	    VNodeWrapper.prototype.wrap = function (children) {
	        var _a = this.rootElement, tagName = _a.tagName, id = _a.id, className = _a.className;
	        var selId = id ? "#" + id : '';
	        var selClass = className ? "." + className.split(" ").join(".") : '';
	        return h_1.h("" + tagName.toLowerCase() + selId + selClass, {}, children);
	    };
	    return VNodeWrapper;
	}());
	exports.VNodeWrapper = VNodeWrapper;
	//# sourceMappingURL=VNodeWrapper.js.map

/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	var selectorParser_1 = __webpack_require__(32);
	function classNameFromVNode(vNode) {
	    var _a = selectorParser_1.selectorParser(vNode).className, cn = _a === void 0 ? '' : _a;
	    if (!vNode.data) {
	        return cn;
	    }
	    var _b = vNode.data, dataClass = _b.class, props = _b.props;
	    if (dataClass) {
	        var c = Object.keys(dataClass)
	            .filter(function (cl) { return dataClass[cl]; });
	        cn += " " + c.join(" ");
	    }
	    if (props && props.className) {
	        cn += " " + props.className;
	    }
	    return cn && cn.trim();
	}
	exports.classNameFromVNode = classNameFromVNode;
	//# sourceMappingURL=classNameFromVNode.js.map

/***/ }),
/* 32 */
/***/ (function(module, exports) {

	"use strict";
	function selectorParser(node) {
	    if (!node.sel) {
	        return {
	            tagName: '',
	            id: '',
	            className: '',
	        };
	    }
	    var sel = node.sel;
	    var hashIdx = sel.indexOf('#');
	    var dotIdx = sel.indexOf('.', hashIdx);
	    var hash = hashIdx > 0 ? hashIdx : sel.length;
	    var dot = dotIdx > 0 ? dotIdx : sel.length;
	    var tagName = hashIdx !== -1 || dotIdx !== -1 ?
	        sel.slice(0, Math.min(hash, dot)) :
	        sel;
	    var id = hash < dot ? sel.slice(hash + 1, dot) : void 0;
	    var className = dotIdx > 0 ? sel.slice(dot + 1).replace(/\./g, ' ') : void 0;
	    return {
	        tagName: tagName,
	        id: id,
	        className: className,
	    };
	}
	exports.selectorParser = selectorParser;
	//# sourceMappingURL=selectorParser.js.map

/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var class_1 = __webpack_require__(34);
	exports.ClassModule = class_1.default;
	var props_1 = __webpack_require__(35);
	exports.PropsModule = props_1.default;
	var attributes_1 = __webpack_require__(36);
	exports.AttrsModule = attributes_1.default;
	var style_1 = __webpack_require__(37);
	exports.StyleModule = style_1.default;
	var dataset_1 = __webpack_require__(38);
	exports.DatasetModule = dataset_1.default;
	var modules = [
	    style_1.default,
	    class_1.default,
	    props_1.default,
	    attributes_1.default,
	    dataset_1.default,
	];
	exports.default = modules;
	//# sourceMappingURL=modules.js.map

/***/ }),
/* 34 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function updateClass(oldVnode, vnode) {
	    var cur, name, elm = vnode.elm, oldClass = oldVnode.data.class, klass = vnode.data.class;
	    if (!oldClass && !klass)
	        return;
	    if (oldClass === klass)
	        return;
	    oldClass = oldClass || {};
	    klass = klass || {};
	    for (name in oldClass) {
	        if (!klass[name]) {
	            elm.classList.remove(name);
	        }
	    }
	    for (name in klass) {
	        cur = klass[name];
	        if (cur !== oldClass[name]) {
	            elm.classList[cur ? 'add' : 'remove'](name);
	        }
	    }
	}
	exports.classModule = { create: updateClass, update: updateClass };
	exports.default = exports.classModule;
	//# sourceMappingURL=class.js.map

/***/ }),
/* 35 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	function updateProps(oldVnode, vnode) {
	    var key, cur, old, elm = vnode.elm, oldProps = oldVnode.data.props, props = vnode.data.props;
	    if (!oldProps && !props)
	        return;
	    if (oldProps === props)
	        return;
	    oldProps = oldProps || {};
	    props = props || {};
	    for (key in oldProps) {
	        if (!props[key]) {
	            delete elm[key];
	        }
	    }
	    for (key in props) {
	        cur = props[key];
	        old = oldProps[key];
	        if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
	            elm[key] = cur;
	        }
	    }
	}
	exports.propsModule = { create: updateProps, update: updateProps };
	exports.default = exports.propsModule;
	//# sourceMappingURL=props.js.map

/***/ }),
/* 36 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var xlinkNS = 'http://www.w3.org/1999/xlink';
	var xmlNS = 'http://www.w3.org/XML/1998/namespace';
	var colonChar = 58;
	var xChar = 120;
	function updateAttrs(oldVnode, vnode) {
	    var key, elm = vnode.elm, oldAttrs = oldVnode.data.attrs, attrs = vnode.data.attrs;
	    if (!oldAttrs && !attrs)
	        return;
	    if (oldAttrs === attrs)
	        return;
	    oldAttrs = oldAttrs || {};
	    attrs = attrs || {};
	    // update modified attributes, add new attributes
	    for (key in attrs) {
	        var cur = attrs[key];
	        var old = oldAttrs[key];
	        if (old !== cur) {
	            if (cur === true) {
	                elm.setAttribute(key, "");
	            }
	            else if (cur === false) {
	                elm.removeAttribute(key);
	            }
	            else {
	                if (key.charCodeAt(0) !== xChar) {
	                    elm.setAttribute(key, cur);
	                }
	                else if (key.charCodeAt(3) === colonChar) {
	                    // Assume xml namespace
	                    elm.setAttributeNS(xmlNS, key, cur);
	                }
	                else if (key.charCodeAt(5) === colonChar) {
	                    // Assume xlink namespace
	                    elm.setAttributeNS(xlinkNS, key, cur);
	                }
	                else {
	                    elm.setAttribute(key, cur);
	                }
	            }
	        }
	    }
	    // remove removed attributes
	    // use `in` operator since the previous `for` iteration uses it (.i.e. add even attributes with undefined value)
	    // the other option is to remove all attributes with value == undefined
	    for (key in oldAttrs) {
	        if (!(key in attrs)) {
	            elm.removeAttribute(key);
	        }
	    }
	}
	exports.attributesModule = { create: updateAttrs, update: updateAttrs };
	exports.default = exports.attributesModule;
	//# sourceMappingURL=attributes.js.map

/***/ }),
/* 37 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var raf = (typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout;
	var nextFrame = function (fn) { raf(function () { raf(fn); }); };
	function setNextFrame(obj, prop, val) {
	    nextFrame(function () { obj[prop] = val; });
	}
	function updateStyle(oldVnode, vnode) {
	    var cur, name, elm = vnode.elm, oldStyle = oldVnode.data.style, style = vnode.data.style;
	    if (!oldStyle && !style)
	        return;
	    if (oldStyle === style)
	        return;
	    oldStyle = oldStyle || {};
	    style = style || {};
	    var oldHasDel = 'delayed' in oldStyle;
	    for (name in oldStyle) {
	        if (!style[name]) {
	            if (name[0] === '-' && name[1] === '-') {
	                elm.style.removeProperty(name);
	            }
	            else {
	                elm.style[name] = '';
	            }
	        }
	    }
	    for (name in style) {
	        cur = style[name];
	        if (name === 'delayed' && style.delayed) {
	            for (var name2 in style.delayed) {
	                cur = style.delayed[name2];
	                if (!oldHasDel || cur !== oldStyle.delayed[name2]) {
	                    setNextFrame(elm.style, name2, cur);
	                }
	            }
	        }
	        else if (name !== 'remove' && cur !== oldStyle[name]) {
	            if (name[0] === '-' && name[1] === '-') {
	                elm.style.setProperty(name, cur);
	            }
	            else {
	                elm.style[name] = cur;
	            }
	        }
	    }
	}
	function applyDestroyStyle(vnode) {
	    var style, name, elm = vnode.elm, s = vnode.data.style;
	    if (!s || !(style = s.destroy))
	        return;
	    for (name in style) {
	        elm.style[name] = style[name];
	    }
	}
	function applyRemoveStyle(vnode, rm) {
	    var s = vnode.data.style;
	    if (!s || !s.remove) {
	        rm();
	        return;
	    }
	    var name, elm = vnode.elm, i = 0, compStyle, style = s.remove, amount = 0, applied = [];
	    for (name in style) {
	        applied.push(name);
	        elm.style[name] = style[name];
	    }
	    compStyle = getComputedStyle(elm);
	    var props = compStyle['transition-property'].split(', ');
	    for (; i < props.length; ++i) {
	        if (applied.indexOf(props[i]) !== -1)
	            amount++;
	    }
	    elm.addEventListener('transitionend', function (ev) {
	        if (ev.target === elm)
	            --amount;
	        if (amount === 0)
	            rm();
	    });
	}
	exports.styleModule = {
	    create: updateStyle,
	    update: updateStyle,
	    destroy: applyDestroyStyle,
	    remove: applyRemoveStyle
	};
	exports.default = exports.styleModule;
	//# sourceMappingURL=style.js.map

/***/ }),
/* 38 */
/***/ (function(module, exports) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var CAPS_REGEX = /[A-Z]/g;
	function updateDataset(oldVnode, vnode) {
	    var elm = vnode.elm, oldDataset = oldVnode.data.dataset, dataset = vnode.data.dataset, key;
	    if (!oldDataset && !dataset)
	        return;
	    if (oldDataset === dataset)
	        return;
	    oldDataset = oldDataset || {};
	    dataset = dataset || {};
	    var d = elm.dataset;
	    for (key in oldDataset) {
	        if (!dataset[key]) {
	            if (d) {
	                if (key in d) {
	                    delete d[key];
	                }
	            }
	            else {
	                elm.removeAttribute('data-' + key.replace(CAPS_REGEX, '-$&').toLowerCase());
	            }
	        }
	    }
	    for (key in dataset) {
	        if (oldDataset[key] !== dataset[key]) {
	            if (d) {
	                d[key] = dataset[key];
	            }
	            else {
	                elm.setAttribute('data-' + key.replace(CAPS_REGEX, '-$&').toLowerCase(), dataset[key]);
	            }
	        }
	    }
	}
	exports.datasetModule = { create: updateDataset, update: updateDataset };
	exports.default = exports.datasetModule;
	//# sourceMappingURL=dataset.js.map

/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var MapPolyfill = __webpack_require__(40);
	var IsolateModule = (function () {
	    function IsolateModule() {
	        this.elementsByFullScope = new MapPolyfill();
	        this.delegatorsByFullScope = new MapPolyfill();
	        this.fullScopesBeingUpdated = [];
	        this.vnodesBeingRemoved = [];
	    }
	    IsolateModule.prototype.cleanupVNode = function (_a) {
	        var data = _a.data, elm = _a.elm;
	        var fullScope = (data || {}).isolate || '';
	        var isCurrentElm = this.elementsByFullScope.get(fullScope) === elm;
	        var isScopeBeingUpdated = this.fullScopesBeingUpdated.indexOf(fullScope) >= 0;
	        if (fullScope && isCurrentElm && !isScopeBeingUpdated) {
	            this.elementsByFullScope.delete(fullScope);
	            this.delegatorsByFullScope.delete(fullScope);
	        }
	    };
	    IsolateModule.prototype.getElement = function (fullScope) {
	        return this.elementsByFullScope.get(fullScope);
	    };
	    IsolateModule.prototype.getFullScope = function (elm) {
	        var iterator = this.elementsByFullScope.entries();
	        for (var result = iterator.next(); !!result.value; result = iterator.next()) {
	            var _a = result.value, fullScope = _a[0], element = _a[1];
	            if (elm === element) {
	                return fullScope;
	            }
	        }
	        return '';
	    };
	    IsolateModule.prototype.addEventDelegator = function (fullScope, eventDelegator) {
	        var delegators = this.delegatorsByFullScope.get(fullScope);
	        if (!delegators) {
	            delegators = [];
	            this.delegatorsByFullScope.set(fullScope, delegators);
	        }
	        delegators[delegators.length] = eventDelegator;
	    };
	    IsolateModule.prototype.reset = function () {
	        this.elementsByFullScope.clear();
	        this.delegatorsByFullScope.clear();
	        this.fullScopesBeingUpdated = [];
	    };
	    IsolateModule.prototype.createModule = function () {
	        var self = this;
	        return {
	            create: function (oldVNode, vNode) {
	                var _a = oldVNode.data, oldData = _a === void 0 ? {} : _a;
	                var elm = vNode.elm, _b = vNode.data, data = _b === void 0 ? {} : _b;
	                var oldFullScope = oldData.isolate || '';
	                var fullScope = data.isolate || '';
	                // Update data structures with the newly-created element
	                if (fullScope) {
	                    self.fullScopesBeingUpdated.push(fullScope);
	                    if (oldFullScope) {
	                        self.elementsByFullScope.delete(oldFullScope);
	                    }
	                    self.elementsByFullScope.set(fullScope, elm);
	                    // Update delegators for this scope
	                    var delegators = self.delegatorsByFullScope.get(fullScope);
	                    if (delegators) {
	                        var len = delegators.length;
	                        for (var i = 0; i < len; ++i) {
	                            delegators[i].updateOrigin(elm);
	                        }
	                    }
	                }
	                if (oldFullScope && !fullScope) {
	                    self.elementsByFullScope.delete(fullScope);
	                }
	            },
	            update: function (oldVNode, vNode) {
	                var _a = oldVNode.data, oldData = _a === void 0 ? {} : _a;
	                var elm = vNode.elm, _b = vNode.data, data = _b === void 0 ? {} : _b;
	                var oldFullScope = oldData.isolate || '';
	                var fullScope = data.isolate || '';
	                // Same element, but different scope, so update the data structures
	                if (fullScope && fullScope !== oldFullScope) {
	                    if (oldFullScope) {
	                        self.elementsByFullScope.delete(oldFullScope);
	                    }
	                    self.elementsByFullScope.set(fullScope, elm);
	                    var delegators = self.delegatorsByFullScope.get(oldFullScope);
	                    if (delegators) {
	                        self.delegatorsByFullScope.delete(oldFullScope);
	                        self.delegatorsByFullScope.set(fullScope, delegators);
	                    }
	                }
	                // Same element, but lost the scope, so update the data structures
	                if (oldFullScope && !fullScope) {
	                    self.elementsByFullScope.delete(oldFullScope);
	                    self.delegatorsByFullScope.delete(oldFullScope);
	                }
	            },
	            destroy: function (vNode) {
	                self.vnodesBeingRemoved.push(vNode);
	            },
	            remove: function (vNode, cb) {
	                self.vnodesBeingRemoved.push(vNode);
	                cb();
	            },
	            post: function () {
	                var vnodesBeingRemoved = self.vnodesBeingRemoved;
	                for (var i = vnodesBeingRemoved.length - 1; i >= 0; i--) {
	                    self.cleanupVNode(vnodesBeingRemoved[i]);
	                }
	                self.vnodesBeingRemoved = [];
	                self.fullScopesBeingUpdated = [];
	            },
	        };
	    };
	    return IsolateModule;
	}());
	exports.IsolateModule = IsolateModule;
	//# sourceMappingURL=IsolateModule.js.map

/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(41)() ? Map : __webpack_require__(42);


/***/ }),
/* 41 */
/***/ (function(module, exports) {

	'use strict';
	
	module.exports = function () {
		var map, iterator, result;
		if (typeof Map !== 'function') return false;
		try {
			// WebKit doesn't support arguments and crashes
			map = new Map([['raz', 'one'], ['dwa', 'two'], ['trzy', 'three']]);
		} catch (e) {
			return false;
		}
		if (String(map) !== '[object Map]') return false;
		if (map.size !== 3) return false;
		if (typeof map.clear !== 'function') return false;
		if (typeof map.delete !== 'function') return false;
		if (typeof map.entries !== 'function') return false;
		if (typeof map.forEach !== 'function') return false;
		if (typeof map.get !== 'function') return false;
		if (typeof map.has !== 'function') return false;
		if (typeof map.keys !== 'function') return false;
		if (typeof map.set !== 'function') return false;
		if (typeof map.values !== 'function') return false;
	
		iterator = map.entries();
		result = iterator.next();
		if (result.done !== false) return false;
		if (!result.value) return false;
		if (result.value[0] !== 'raz') return false;
		if (result.value[1] !== 'one') return false;
	
		return true;
	};


/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var clear          = __webpack_require__(43)
	  , eIndexOf       = __webpack_require__(47)
	  , setPrototypeOf = __webpack_require__(56)
	  , callable       = __webpack_require__(61)
	  , validValue     = __webpack_require__(44)
	  , d              = __webpack_require__(62)
	  , ee             = __webpack_require__(74)
	  , Symbol         = __webpack_require__(75)
	  , iterator       = __webpack_require__(80)
	  , forOf          = __webpack_require__(84)
	  , Iterator       = __webpack_require__(98)
	  , isNative       = __webpack_require__(101)
	
	  , call = Function.prototype.call
	  , defineProperties = Object.defineProperties, getPrototypeOf = Object.getPrototypeOf
	  , MapPoly;
	
	module.exports = MapPoly = function (/*iterable*/) {
		var iterable = arguments[0], keys, values, self;
		if (!(this instanceof MapPoly)) throw new TypeError('Constructor requires \'new\'');
		if (isNative && setPrototypeOf && (Map !== MapPoly)) {
			self = setPrototypeOf(new Map(), getPrototypeOf(this));
		} else {
			self = this;
		}
		if (iterable != null) iterator(iterable);
		defineProperties(self, {
			__mapKeysData__: d('c', keys = []),
			__mapValuesData__: d('c', values = [])
		});
		if (!iterable) return self;
		forOf(iterable, function (value) {
			var key = validValue(value)[0];
			value = value[1];
			if (eIndexOf.call(keys, key) !== -1) return;
			keys.push(key);
			values.push(value);
		}, self);
		return self;
	};
	
	if (isNative) {
		if (setPrototypeOf) setPrototypeOf(MapPoly, Map);
		MapPoly.prototype = Object.create(Map.prototype, {
			constructor: d(MapPoly)
		});
	}
	
	ee(defineProperties(MapPoly.prototype, {
		clear: d(function () {
			if (!this.__mapKeysData__.length) return;
			clear.call(this.__mapKeysData__);
			clear.call(this.__mapValuesData__);
			this.emit('_clear');
		}),
		delete: d(function (key) {
			var index = eIndexOf.call(this.__mapKeysData__, key);
			if (index === -1) return false;
			this.__mapKeysData__.splice(index, 1);
			this.__mapValuesData__.splice(index, 1);
			this.emit('_delete', index, key);
			return true;
		}),
		entries: d(function () { return new Iterator(this, 'key+value'); }),
		forEach: d(function (cb/*, thisArg*/) {
			var thisArg = arguments[1], iterator, result;
			callable(cb);
			iterator = this.entries();
			result = iterator._next();
			while (result !== undefined) {
				call.call(cb, thisArg, this.__mapValuesData__[result],
					this.__mapKeysData__[result], this);
				result = iterator._next();
			}
		}),
		get: d(function (key) {
			var index = eIndexOf.call(this.__mapKeysData__, key);
			if (index === -1) return;
			return this.__mapValuesData__[index];
		}),
		has: d(function (key) {
			return (eIndexOf.call(this.__mapKeysData__, key) !== -1);
		}),
		keys: d(function () { return new Iterator(this, 'key'); }),
		set: d(function (key, value) {
			var index = eIndexOf.call(this.__mapKeysData__, key), emit;
			if (index === -1) {
				index = this.__mapKeysData__.push(key) - 1;
				emit = true;
			}
			this.__mapValuesData__[index] = value;
			if (emit) this.emit('_add', index, key);
			return this;
		}),
		size: d.gs(function () { return this.__mapKeysData__.length; }),
		values: d(function () { return new Iterator(this, 'value'); }),
		toString: d(function () { return '[object Map]'; })
	}));
	Object.defineProperty(MapPoly.prototype, Symbol.iterator, d(function () {
		return this.entries();
	}));
	Object.defineProperty(MapPoly.prototype, Symbol.toStringTag, d('c', 'Map'));


/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

	// Inspired by Google Closure:
	// http://closure-library.googlecode.com/svn/docs/
	// closure_goog_array_array.js.html#goog.array.clear
	
	"use strict";
	
	var value = __webpack_require__(44);
	
	module.exports = function () {
		value(this).length = 0;
		return this;
	};


/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isValue = __webpack_require__(45);
	
	module.exports = function (value) {
		if (!isValue(value)) throw new TypeError("Cannot use null or undefined");
		return value;
	};


/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var _undefined = __webpack_require__(46)(); // Support ES3 engines
	
	module.exports = function (val) {
	 return (val !== _undefined) && (val !== null);
	};


/***/ }),
/* 46 */
/***/ (function(module, exports) {

	"use strict";
	
	// eslint-disable-next-line no-empty-function
	module.exports = function () {};


/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var numberIsNaN       = __webpack_require__(48)
	  , toPosInt          = __webpack_require__(51)
	  , value             = __webpack_require__(44)
	  , indexOf           = Array.prototype.indexOf
	  , objHasOwnProperty = Object.prototype.hasOwnProperty
	  , abs               = Math.abs
	  , floor             = Math.floor;
	
	module.exports = function (searchElement /*, fromIndex*/) {
		var i, length, fromIndex, val;
		if (!numberIsNaN(searchElement)) return indexOf.apply(this, arguments);
	
		length = toPosInt(value(this).length);
		fromIndex = arguments[1];
		if (isNaN(fromIndex)) fromIndex = 0;
		else if (fromIndex >= 0) fromIndex = floor(fromIndex);
		else fromIndex = toPosInt(this.length) - floor(abs(fromIndex));
	
		for (i = fromIndex; i < length; ++i) {
			if (objHasOwnProperty.call(this, i)) {
				val = this[i];
				if (numberIsNaN(val)) return i; // Jslint: ignore
			}
		}
		return -1;
	};


/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(49)()
		? Number.isNaN
		: __webpack_require__(50);


/***/ }),
/* 49 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function () {
		var numberIsNaN = Number.isNaN;
		if (typeof numberIsNaN !== "function") return false;
		return !numberIsNaN({}) && numberIsNaN(NaN) && !numberIsNaN(34);
	};


/***/ }),
/* 50 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function (value) {
		// eslint-disable-next-line no-self-compare
		return value !== value;
	};


/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var toInteger = __webpack_require__(52)
	
	  , max = Math.max;
	
	module.exports = function (value) {
	 return max(0, toInteger(value));
	};


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var sign = __webpack_require__(53)
	
	  , abs = Math.abs, floor = Math.floor;
	
	module.exports = function (value) {
		if (isNaN(value)) return 0;
		value = Number(value);
		if ((value === 0) || !isFinite(value)) return value;
		return sign(value) * floor(abs(value));
	};


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(54)()
		? Math.sign
		: __webpack_require__(55);


/***/ }),
/* 54 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function () {
		var sign = Math.sign;
		if (typeof sign !== "function") return false;
		return (sign(10) === 1) && (sign(-20) === -1);
	};


/***/ }),
/* 55 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function (value) {
		value = Number(value);
		if (isNaN(value) || (value === 0)) return value;
		return value > 0 ? 1 : -1;
	};


/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(57)()
		? Object.setPrototypeOf
		: __webpack_require__(58);


/***/ }),
/* 57 */
/***/ (function(module, exports) {

	"use strict";
	
	var create = Object.create, getPrototypeOf = Object.getPrototypeOf, plainObject = {};
	
	module.exports = function (/* CustomCreate*/) {
		var setPrototypeOf = Object.setPrototypeOf, customCreate = arguments[0] || create;
		if (typeof setPrototypeOf !== "function") return false;
		return getPrototypeOf(setPrototypeOf(customCreate(null), plainObject)) === plainObject;
	};


/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {

	/* eslint no-proto: "off" */
	
	// Big thanks to @WebReflection for sorting this out
	// https://gist.github.com/WebReflection/5593554
	
	"use strict";
	
	var isObject        = __webpack_require__(59)
	  , value           = __webpack_require__(44)
	  , objIsPrototypeOf = Object.prototype.isPrototypeOf
	  , defineProperty  = Object.defineProperty
	  , nullDesc        = {
		configurable: true,
		enumerable: false,
		writable: true,
		value: undefined
	}
	  , validate;
	
	validate = function (obj, prototype) {
		value(obj);
		if (prototype === null || isObject(prototype)) return obj;
		throw new TypeError("Prototype must be null or an object");
	};
	
	module.exports = (function (status) {
		var fn, set;
		if (!status) return null;
		if (status.level === 2) {
			if (status.set) {
				set = status.set;
				fn = function (obj, prototype) {
					set.call(validate(obj, prototype), prototype);
					return obj;
				};
			} else {
				fn = function (obj, prototype) {
					validate(obj, prototype).__proto__ = prototype;
					return obj;
				};
			}
		} else {
			fn = function self(obj, prototype) {
				var isNullBase;
				validate(obj, prototype);
				isNullBase = objIsPrototypeOf.call(self.nullPolyfill, obj);
				if (isNullBase) delete self.nullPolyfill.__proto__;
				if (prototype === null) prototype = self.nullPolyfill;
				obj.__proto__ = prototype;
				if (isNullBase) defineProperty(self.nullPolyfill, "__proto__", nullDesc);
				return obj;
			};
		}
		return Object.defineProperty(fn, "level", {
			configurable: false,
			enumerable: false,
			writable: false,
			value: status.level
		});
	}(
		(function () {
			var tmpObj1 = Object.create(null)
			  , tmpObj2 = {}
			  , set
			  , desc = Object.getOwnPropertyDescriptor(Object.prototype, "__proto__");
	
			if (desc) {
				try {
					set = desc.set; // Opera crashes at this point
					set.call(tmpObj1, tmpObj2);
				} catch (ignore) {}
				if (Object.getPrototypeOf(tmpObj1) === tmpObj2) return { set: set, level: 2 };
			}
	
			tmpObj1.__proto__ = tmpObj2;
			if (Object.getPrototypeOf(tmpObj1) === tmpObj2) return { level: 2 };
	
			tmpObj1 = {};
			tmpObj1.__proto__ = tmpObj2;
			if (Object.getPrototypeOf(tmpObj1) === tmpObj2) return { level: 1 };
	
			return false;
		})()
	));
	
	__webpack_require__(60);


/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isValue = __webpack_require__(45);
	
	var map = { function: true, object: true };
	
	module.exports = function (value) {
		return (isValue(value) && map[typeof value]) || false;
	};


/***/ }),
/* 60 */
/***/ (function(module, exports, __webpack_require__) {

	// Workaround for http://code.google.com/p/v8/issues/detail?id=2804
	
	"use strict";
	
	var create = Object.create, shim;
	
	if (!__webpack_require__(57)()) {
		shim = __webpack_require__(58);
	}
	
	module.exports = (function () {
		var nullObject, polyProps, desc;
		if (!shim) return create;
		if (shim.level !== 1) return create;
	
		nullObject = {};
		polyProps = {};
		desc = {
			configurable: false,
			enumerable: false,
			writable: true,
			value: undefined
		};
		Object.getOwnPropertyNames(Object.prototype).forEach(function (name) {
			if (name === "__proto__") {
				polyProps[name] = {
					configurable: true,
					enumerable: false,
					writable: true,
					value: undefined
				};
				return;
			}
			polyProps[name] = desc;
		});
		Object.defineProperties(nullObject, polyProps);
	
		Object.defineProperty(shim, "nullPolyfill", {
			configurable: false,
			enumerable: false,
			writable: false,
			value: nullObject
		});
	
		return function (prototype, props) {
			return create(prototype === null ? nullObject : prototype, props);
		};
	}());


/***/ }),
/* 61 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function (fn) {
		if (typeof fn !== "function") throw new TypeError(fn + " is not a function");
		return fn;
	};


/***/ }),
/* 62 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var assign        = __webpack_require__(63)
	  , normalizeOpts = __webpack_require__(69)
	  , isCallable    = __webpack_require__(70)
	  , contains      = __webpack_require__(71)
	
	  , d;
	
	d = module.exports = function (dscr, value/*, options*/) {
		var c, e, w, options, desc;
		if ((arguments.length < 2) || (typeof dscr !== 'string')) {
			options = value;
			value = dscr;
			dscr = null;
		} else {
			options = arguments[2];
		}
		if (dscr == null) {
			c = w = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
			w = contains.call(dscr, 'w');
		}
	
		desc = { value: value, configurable: c, enumerable: e, writable: w };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};
	
	d.gs = function (dscr, get, set/*, options*/) {
		var c, e, options, desc;
		if (typeof dscr !== 'string') {
			options = set;
			set = get;
			get = dscr;
			dscr = null;
		} else {
			options = arguments[3];
		}
		if (get == null) {
			get = undefined;
		} else if (!isCallable(get)) {
			options = get;
			get = set = undefined;
		} else if (set == null) {
			set = undefined;
		} else if (!isCallable(set)) {
			options = set;
			set = undefined;
		}
		if (dscr == null) {
			c = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
		}
	
		desc = { get: get, set: set, configurable: c, enumerable: e };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};


/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(64)()
		? Object.assign
		: __webpack_require__(65);


/***/ }),
/* 64 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function () {
		var assign = Object.assign, obj;
		if (typeof assign !== "function") return false;
		obj = { foo: "raz" };
		assign(obj, { bar: "dwa" }, { trzy: "trzy" });
		return (obj.foo + obj.bar + obj.trzy) === "razdwatrzy";
	};


/***/ }),
/* 65 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var keys  = __webpack_require__(66)
	  , value = __webpack_require__(44)
	  , max   = Math.max;
	
	module.exports = function (dest, src /*, …srcn*/) {
		var error, i, length = max(arguments.length, 2), assign;
		dest = Object(value(dest));
		assign = function (key) {
			try {
				dest[key] = src[key];
			} catch (e) {
				if (!error) error = e;
			}
		};
		for (i = 1; i < length; ++i) {
			src = arguments[i];
			keys(src).forEach(assign);
		}
		if (error !== undefined) throw error;
		return dest;
	};


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(67)()
		? Object.keys
		: __webpack_require__(68);


/***/ }),
/* 67 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function () {
		try {
			Object.keys("primitive");
			return true;
		} catch (e) {
	 return false;
	}
	};


/***/ }),
/* 68 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isValue = __webpack_require__(45);
	
	var keys = Object.keys;
	
	module.exports = function (object) {
		return keys(isValue(object) ? Object(object) : object);
	};


/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isValue = __webpack_require__(45);
	
	var forEach = Array.prototype.forEach, create = Object.create;
	
	var process = function (src, obj) {
		var key;
		for (key in src) obj[key] = src[key];
	};
	
	// eslint-disable-next-line no-unused-vars
	module.exports = function (opts1 /*, …options*/) {
		var result = create(null);
		forEach.call(arguments, function (options) {
			if (!isValue(options)) return;
			process(Object(options), result);
		});
		return result;
	};


/***/ }),
/* 70 */
/***/ (function(module, exports) {

	// Deprecated
	
	"use strict";
	
	module.exports = function (obj) {
	 return typeof obj === "function";
	};


/***/ }),
/* 71 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(72)()
		? String.prototype.contains
		: __webpack_require__(73);


/***/ }),
/* 72 */
/***/ (function(module, exports) {

	"use strict";
	
	var str = "razdwatrzy";
	
	module.exports = function () {
		if (typeof str.contains !== "function") return false;
		return (str.contains("dwa") === true) && (str.contains("foo") === false);
	};


/***/ }),
/* 73 */
/***/ (function(module, exports) {

	"use strict";
	
	var indexOf = String.prototype.indexOf;
	
	module.exports = function (searchString/*, position*/) {
		return indexOf.call(this, searchString, arguments[1]) > -1;
	};


/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var d        = __webpack_require__(62)
	  , callable = __webpack_require__(61)
	
	  , apply = Function.prototype.apply, call = Function.prototype.call
	  , create = Object.create, defineProperty = Object.defineProperty
	  , defineProperties = Object.defineProperties
	  , hasOwnProperty = Object.prototype.hasOwnProperty
	  , descriptor = { configurable: true, enumerable: false, writable: true }
	
	  , on, once, off, emit, methods, descriptors, base;
	
	on = function (type, listener) {
		var data;
	
		callable(listener);
	
		if (!hasOwnProperty.call(this, '__ee__')) {
			data = descriptor.value = create(null);
			defineProperty(this, '__ee__', descriptor);
			descriptor.value = null;
		} else {
			data = this.__ee__;
		}
		if (!data[type]) data[type] = listener;
		else if (typeof data[type] === 'object') data[type].push(listener);
		else data[type] = [data[type], listener];
	
		return this;
	};
	
	once = function (type, listener) {
		var once, self;
	
		callable(listener);
		self = this;
		on.call(this, type, once = function () {
			off.call(self, type, once);
			apply.call(listener, this, arguments);
		});
	
		once.__eeOnceListener__ = listener;
		return this;
	};
	
	off = function (type, listener) {
		var data, listeners, candidate, i;
	
		callable(listener);
	
		if (!hasOwnProperty.call(this, '__ee__')) return this;
		data = this.__ee__;
		if (!data[type]) return this;
		listeners = data[type];
	
		if (typeof listeners === 'object') {
			for (i = 0; (candidate = listeners[i]); ++i) {
				if ((candidate === listener) ||
						(candidate.__eeOnceListener__ === listener)) {
					if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
					else listeners.splice(i, 1);
				}
			}
		} else {
			if ((listeners === listener) ||
					(listeners.__eeOnceListener__ === listener)) {
				delete data[type];
			}
		}
	
		return this;
	};
	
	emit = function (type) {
		var i, l, listener, listeners, args;
	
		if (!hasOwnProperty.call(this, '__ee__')) return;
		listeners = this.__ee__[type];
		if (!listeners) return;
	
		if (typeof listeners === 'object') {
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) args[i - 1] = arguments[i];
	
			listeners = listeners.slice();
			for (i = 0; (listener = listeners[i]); ++i) {
				apply.call(listener, this, args);
			}
		} else {
			switch (arguments.length) {
			case 1:
				call.call(listeners, this);
				break;
			case 2:
				call.call(listeners, this, arguments[1]);
				break;
			case 3:
				call.call(listeners, this, arguments[1], arguments[2]);
				break;
			default:
				l = arguments.length;
				args = new Array(l - 1);
				for (i = 1; i < l; ++i) {
					args[i - 1] = arguments[i];
				}
				apply.call(listeners, this, args);
			}
		}
	};
	
	methods = {
		on: on,
		once: once,
		off: off,
		emit: emit
	};
	
	descriptors = {
		on: d(on),
		once: d(once),
		off: d(off),
		emit: d(emit)
	};
	
	base = defineProperties({}, descriptors);
	
	module.exports = exports = function (o) {
		return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
	};
	exports.methods = methods;


/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(76)() ? Symbol : __webpack_require__(77);


/***/ }),
/* 76 */
/***/ (function(module, exports) {

	'use strict';
	
	var validTypes = { object: true, symbol: true };
	
	module.exports = function () {
		var symbol;
		if (typeof Symbol !== 'function') return false;
		symbol = Symbol('test symbol');
		try { String(symbol); } catch (e) { return false; }
	
		// Return 'true' also for polyfills
		if (!validTypes[typeof Symbol.iterator]) return false;
		if (!validTypes[typeof Symbol.toPrimitive]) return false;
		if (!validTypes[typeof Symbol.toStringTag]) return false;
	
		return true;
	};


/***/ }),
/* 77 */
/***/ (function(module, exports, __webpack_require__) {

	// ES2015 Symbol polyfill for environments that do not (or partially) support it
	
	'use strict';
	
	var d              = __webpack_require__(62)
	  , validateSymbol = __webpack_require__(78)
	
	  , create = Object.create, defineProperties = Object.defineProperties
	  , defineProperty = Object.defineProperty, objPrototype = Object.prototype
	  , NativeSymbol, SymbolPolyfill, HiddenSymbol, globalSymbols = create(null)
	  , isNativeSafe;
	
	if (typeof Symbol === 'function') {
		NativeSymbol = Symbol;
		try {
			String(NativeSymbol());
			isNativeSafe = true;
		} catch (ignore) {}
	}
	
	var generateName = (function () {
		var created = create(null);
		return function (desc) {
			var postfix = 0, name, ie11BugWorkaround;
			while (created[desc + (postfix || '')]) ++postfix;
			desc += (postfix || '');
			created[desc] = true;
			name = '@@' + desc;
			defineProperty(objPrototype, name, d.gs(null, function (value) {
				// For IE11 issue see:
				// https://connect.microsoft.com/IE/feedbackdetail/view/1928508/
				//    ie11-broken-getters-on-dom-objects
				// https://github.com/medikoo/es6-symbol/issues/12
				if (ie11BugWorkaround) return;
				ie11BugWorkaround = true;
				defineProperty(this, name, d(value));
				ie11BugWorkaround = false;
			}));
			return name;
		};
	}());
	
	// Internal constructor (not one exposed) for creating Symbol instances.
	// This one is used to ensure that `someSymbol instanceof Symbol` always return false
	HiddenSymbol = function Symbol(description) {
		if (this instanceof HiddenSymbol) throw new TypeError('Symbol is not a constructor');
		return SymbolPolyfill(description);
	};
	
	// Exposed `Symbol` constructor
	// (returns instances of HiddenSymbol)
	module.exports = SymbolPolyfill = function Symbol(description) {
		var symbol;
		if (this instanceof Symbol) throw new TypeError('Symbol is not a constructor');
		if (isNativeSafe) return NativeSymbol(description);
		symbol = create(HiddenSymbol.prototype);
		description = (description === undefined ? '' : String(description));
		return defineProperties(symbol, {
			__description__: d('', description),
			__name__: d('', generateName(description))
		});
	};
	defineProperties(SymbolPolyfill, {
		for: d(function (key) {
			if (globalSymbols[key]) return globalSymbols[key];
			return (globalSymbols[key] = SymbolPolyfill(String(key)));
		}),
		keyFor: d(function (s) {
			var key;
			validateSymbol(s);
			for (key in globalSymbols) if (globalSymbols[key] === s) return key;
		}),
	
		// To ensure proper interoperability with other native functions (e.g. Array.from)
		// fallback to eventual native implementation of given symbol
		hasInstance: d('', (NativeSymbol && NativeSymbol.hasInstance) || SymbolPolyfill('hasInstance')),
		isConcatSpreadable: d('', (NativeSymbol && NativeSymbol.isConcatSpreadable) ||
			SymbolPolyfill('isConcatSpreadable')),
		iterator: d('', (NativeSymbol && NativeSymbol.iterator) || SymbolPolyfill('iterator')),
		match: d('', (NativeSymbol && NativeSymbol.match) || SymbolPolyfill('match')),
		replace: d('', (NativeSymbol && NativeSymbol.replace) || SymbolPolyfill('replace')),
		search: d('', (NativeSymbol && NativeSymbol.search) || SymbolPolyfill('search')),
		species: d('', (NativeSymbol && NativeSymbol.species) || SymbolPolyfill('species')),
		split: d('', (NativeSymbol && NativeSymbol.split) || SymbolPolyfill('split')),
		toPrimitive: d('', (NativeSymbol && NativeSymbol.toPrimitive) || SymbolPolyfill('toPrimitive')),
		toStringTag: d('', (NativeSymbol && NativeSymbol.toStringTag) || SymbolPolyfill('toStringTag')),
		unscopables: d('', (NativeSymbol && NativeSymbol.unscopables) || SymbolPolyfill('unscopables'))
	});
	
	// Internal tweaks for real symbol producer
	defineProperties(HiddenSymbol.prototype, {
		constructor: d(SymbolPolyfill),
		toString: d('', function () { return this.__name__; })
	});
	
	// Proper implementation of methods exposed on Symbol.prototype
	// They won't be accessible on produced symbol instances as they derive from HiddenSymbol.prototype
	defineProperties(SymbolPolyfill.prototype, {
		toString: d(function () { return 'Symbol (' + validateSymbol(this).__description__ + ')'; }),
		valueOf: d(function () { return validateSymbol(this); })
	});
	defineProperty(SymbolPolyfill.prototype, SymbolPolyfill.toPrimitive, d('', function () {
		var symbol = validateSymbol(this);
		if (typeof symbol === 'symbol') return symbol;
		return symbol.toString();
	}));
	defineProperty(SymbolPolyfill.prototype, SymbolPolyfill.toStringTag, d('c', 'Symbol'));
	
	// Proper implementaton of toPrimitive and toStringTag for returned symbol instances
	defineProperty(HiddenSymbol.prototype, SymbolPolyfill.toStringTag,
		d('c', SymbolPolyfill.prototype[SymbolPolyfill.toStringTag]));
	
	// Note: It's important to define `toPrimitive` as last one, as some implementations
	// implement `toPrimitive` natively without implementing `toStringTag` (or other specified symbols)
	// And that may invoke error in definition flow:
	// See: https://github.com/medikoo/es6-symbol/issues/13#issuecomment-164146149
	defineProperty(HiddenSymbol.prototype, SymbolPolyfill.toPrimitive,
		d('c', SymbolPolyfill.prototype[SymbolPolyfill.toPrimitive]));


/***/ }),
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var isSymbol = __webpack_require__(79);
	
	module.exports = function (value) {
		if (!isSymbol(value)) throw new TypeError(value + " is not a symbol");
		return value;
	};


/***/ }),
/* 79 */
/***/ (function(module, exports) {

	'use strict';
	
	module.exports = function (x) {
		if (!x) return false;
		if (typeof x === 'symbol') return true;
		if (!x.constructor) return false;
		if (x.constructor.name !== 'Symbol') return false;
		return (x[x.constructor.toStringTag] === 'Symbol');
	};


/***/ }),
/* 80 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isIterable = __webpack_require__(81);
	
	module.exports = function (value) {
		if (!isIterable(value)) throw new TypeError(value + " is not iterable");
		return value;
	};


/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isArguments = __webpack_require__(82)
	  , isValue     = __webpack_require__(45)
	  , isString    = __webpack_require__(83);
	
	var iteratorSymbol = __webpack_require__(75).iterator
	  , isArray        = Array.isArray;
	
	module.exports = function (value) {
		if (!isValue(value)) return false;
		if (isArray(value)) return true;
		if (isString(value)) return true;
		if (isArguments(value)) return true;
		return typeof value[iteratorSymbol] === "function";
	};


/***/ }),
/* 82 */
/***/ (function(module, exports) {

	"use strict";
	
	var objToString = Object.prototype.toString
	  , id = objToString.call(
		(function () {
			return arguments;
		})()
	);
	
	module.exports = function (value) {
		return objToString.call(value) === id;
	};


/***/ }),
/* 83 */
/***/ (function(module, exports) {

	"use strict";
	
	var objToString = Object.prototype.toString, id = objToString.call("");
	
	module.exports = function (value) {
		return (
			typeof value === "string" ||
			(value &&
				typeof value === "object" &&
				(value instanceof String || objToString.call(value) === id)) ||
			false
		);
	};


/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isArguments = __webpack_require__(82)
	  , callable    = __webpack_require__(61)
	  , isString    = __webpack_require__(83)
	  , get         = __webpack_require__(85);
	
	var isArray = Array.isArray, call = Function.prototype.call, some = Array.prototype.some;
	
	module.exports = function (iterable, cb /*, thisArg*/) {
		var mode, thisArg = arguments[2], result, doBreak, broken, i, length, char, code;
		if (isArray(iterable) || isArguments(iterable)) mode = "array";
		else if (isString(iterable)) mode = "string";
		else iterable = get(iterable);
	
		callable(cb);
		doBreak = function () {
			broken = true;
		};
		if (mode === "array") {
			some.call(iterable, function (value) {
				call.call(cb, thisArg, value, doBreak);
				return broken;
			});
			return;
		}
		if (mode === "string") {
			length = iterable.length;
			for (i = 0; i < length; ++i) {
				char = iterable[i];
				if (i + 1 < length) {
					code = char.charCodeAt(0);
					if (code >= 0xd800 && code <= 0xdbff) char += iterable[++i];
				}
				call.call(cb, thisArg, char, doBreak);
				if (broken) break;
			}
			return;
		}
		result = iterable.next();
	
		while (!result.done) {
			call.call(cb, thisArg, result.value, doBreak);
			if (broken) return;
			result = iterable.next();
		}
	};


/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var isArguments    = __webpack_require__(82)
	  , isString       = __webpack_require__(83)
	  , ArrayIterator  = __webpack_require__(86)
	  , StringIterator = __webpack_require__(97)
	  , iterable       = __webpack_require__(80)
	  , iteratorSymbol = __webpack_require__(75).iterator;
	
	module.exports = function (obj) {
		if (typeof iterable(obj)[iteratorSymbol] === "function") return obj[iteratorSymbol]();
		if (isArguments(obj)) return new ArrayIterator(obj);
		if (isString(obj)) return new StringIterator(obj);
		return new ArrayIterator(obj);
	};


/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var setPrototypeOf = __webpack_require__(56)
	  , contains       = __webpack_require__(71)
	  , d              = __webpack_require__(62)
	  , Symbol         = __webpack_require__(75)
	  , Iterator       = __webpack_require__(87);
	
	var defineProperty = Object.defineProperty, ArrayIterator;
	
	ArrayIterator = module.exports = function (arr, kind) {
		if (!(this instanceof ArrayIterator)) throw new TypeError("Constructor requires 'new'");
		Iterator.call(this, arr);
		if (!kind) kind = "value";
		else if (contains.call(kind, "key+value")) kind = "key+value";
		else if (contains.call(kind, "key")) kind = "key";
		else kind = "value";
		defineProperty(this, "__kind__", d("", kind));
	};
	if (setPrototypeOf) setPrototypeOf(ArrayIterator, Iterator);
	
	// Internal %ArrayIteratorPrototype% doesn't expose its constructor
	delete ArrayIterator.prototype.constructor;
	
	ArrayIterator.prototype = Object.create(Iterator.prototype, {
		_resolve: d(function (i) {
			if (this.__kind__ === "value") return this.__list__[i];
			if (this.__kind__ === "key+value") return [i, this.__list__[i]];
			return i;
		})
	});
	defineProperty(ArrayIterator.prototype, Symbol.toStringTag, d("c", "Array Iterator"));


/***/ }),
/* 87 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var clear    = __webpack_require__(43)
	  , assign   = __webpack_require__(63)
	  , callable = __webpack_require__(61)
	  , value    = __webpack_require__(44)
	  , d        = __webpack_require__(62)
	  , autoBind = __webpack_require__(88)
	  , Symbol   = __webpack_require__(75);
	
	var defineProperty = Object.defineProperty, defineProperties = Object.defineProperties, Iterator;
	
	module.exports = Iterator = function (list, context) {
		if (!(this instanceof Iterator)) throw new TypeError("Constructor requires 'new'");
		defineProperties(this, {
			__list__: d("w", value(list)),
			__context__: d("w", context),
			__nextIndex__: d("w", 0)
		});
		if (!context) return;
		callable(context.on);
		context.on("_add", this._onAdd);
		context.on("_delete", this._onDelete);
		context.on("_clear", this._onClear);
	};
	
	// Internal %IteratorPrototype% doesn't expose its constructor
	delete Iterator.prototype.constructor;
	
	defineProperties(
		Iterator.prototype,
		assign(
			{
				_next: d(function () {
					var i;
					if (!this.__list__) return undefined;
					if (this.__redo__) {
						i = this.__redo__.shift();
						if (i !== undefined) return i;
					}
					if (this.__nextIndex__ < this.__list__.length) return this.__nextIndex__++;
					this._unBind();
					return undefined;
				}),
				next: d(function () {
					return this._createResult(this._next());
				}),
				_createResult: d(function (i) {
					if (i === undefined) return { done: true, value: undefined };
					return { done: false, value: this._resolve(i) };
				}),
				_resolve: d(function (i) {
					return this.__list__[i];
				}),
				_unBind: d(function () {
					this.__list__ = null;
					delete this.__redo__;
					if (!this.__context__) return;
					this.__context__.off("_add", this._onAdd);
					this.__context__.off("_delete", this._onDelete);
					this.__context__.off("_clear", this._onClear);
					this.__context__ = null;
				}),
				toString: d(function () {
					return "[object " + (this[Symbol.toStringTag] || "Object") + "]";
				})
			},
			autoBind({
				_onAdd: d(function (index) {
					if (index >= this.__nextIndex__) return;
					++this.__nextIndex__;
					if (!this.__redo__) {
						defineProperty(this, "__redo__", d("c", [index]));
						return;
					}
					this.__redo__.forEach(function (redo, i) {
						if (redo >= index) this.__redo__[i] = ++redo;
					}, this);
					this.__redo__.push(index);
				}),
				_onDelete: d(function (index) {
					var i;
					if (index >= this.__nextIndex__) return;
					--this.__nextIndex__;
					if (!this.__redo__) return;
					i = this.__redo__.indexOf(index);
					if (i !== -1) this.__redo__.splice(i, 1);
					this.__redo__.forEach(function (redo, j) {
						if (redo > index) this.__redo__[j] = --redo;
					}, this);
				}),
				_onClear: d(function () {
					if (this.__redo__) clear.call(this.__redo__);
					this.__nextIndex__ = 0;
				})
			})
		)
	);
	
	defineProperty(
		Iterator.prototype,
		Symbol.iterator,
		d(function () {
			return this;
		})
	);


/***/ }),
/* 88 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var copy             = __webpack_require__(89)
	  , normalizeOptions = __webpack_require__(69)
	  , ensureCallable   = __webpack_require__(61)
	  , map              = __webpack_require__(94)
	  , callable         = __webpack_require__(61)
	  , validValue       = __webpack_require__(44)
	
	  , bind = Function.prototype.bind, defineProperty = Object.defineProperty
	  , hasOwnProperty = Object.prototype.hasOwnProperty
	  , define;
	
	define = function (name, desc, options) {
		var value = validValue(desc) && callable(desc.value), dgs;
		dgs = copy(desc);
		delete dgs.writable;
		delete dgs.value;
		dgs.get = function () {
			if (!options.overwriteDefinition && hasOwnProperty.call(this, name)) return value;
			desc.value = bind.call(value, options.resolveContext ? options.resolveContext(this) : this);
			defineProperty(this, name, desc);
			return this[name];
		};
		return dgs;
	};
	
	module.exports = function (props/*, options*/) {
		var options = normalizeOptions(arguments[1]);
		if (options.resolveContext != null) ensureCallable(options.resolveContext);
		return map(props, function (desc, name) { return define(name, desc, options); });
	};


/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var aFrom  = __webpack_require__(90)
	  , assign = __webpack_require__(63)
	  , value  = __webpack_require__(44);
	
	module.exports = function (obj/*, propertyNames, options*/) {
		var copy = Object(value(obj)), propertyNames = arguments[1], options = Object(arguments[2]);
		if (copy !== obj && !propertyNames) return copy;
		var result = {};
		if (propertyNames) {
			aFrom(propertyNames, function (propertyName) {
				if (options.ensure || propertyName in obj) result[propertyName] = obj[propertyName];
			});
		} else {
			assign(result, obj);
		}
		return result;
	};


/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(91)()
		? Array.from
		: __webpack_require__(92);


/***/ }),
/* 91 */
/***/ (function(module, exports) {

	"use strict";
	
	module.exports = function () {
		var from = Array.from, arr, result;
		if (typeof from !== "function") return false;
		arr = ["raz", "dwa"];
		result = from(arr);
		return Boolean(result && (result !== arr) && (result[1] === "dwa"));
	};


/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var iteratorSymbol = __webpack_require__(75).iterator
	  , isArguments    = __webpack_require__(82)
	  , isFunction     = __webpack_require__(93)
	  , toPosInt       = __webpack_require__(51)
	  , callable       = __webpack_require__(61)
	  , validValue     = __webpack_require__(44)
	  , isValue        = __webpack_require__(45)
	  , isString       = __webpack_require__(83)
	  , isArray        = Array.isArray
	  , call           = Function.prototype.call
	  , desc           = { configurable: true, enumerable: true, writable: true, value: null }
	  , defineProperty = Object.defineProperty;
	
	// eslint-disable-next-line complexity
	module.exports = function (arrayLike /*, mapFn, thisArg*/) {
		var mapFn = arguments[1]
		  , thisArg = arguments[2]
		  , Context
		  , i
		  , j
		  , arr
		  , length
		  , code
		  , iterator
		  , result
		  , getIterator
		  , value;
	
		arrayLike = Object(validValue(arrayLike));
	
		if (isValue(mapFn)) callable(mapFn);
		if (!this || this === Array || !isFunction(this)) {
			// Result: Plain array
			if (!mapFn) {
				if (isArguments(arrayLike)) {
					// Source: Arguments
					length = arrayLike.length;
					if (length !== 1) return Array.apply(null, arrayLike);
					arr = new Array(1);
					arr[0] = arrayLike[0];
					return arr;
				}
				if (isArray(arrayLike)) {
					// Source: Array
					arr = new Array(length = arrayLike.length);
					for (i = 0; i < length; ++i) arr[i] = arrayLike[i];
					return arr;
				}
			}
			arr = [];
		} else {
			// Result: Non plain array
			Context = this;
		}
	
		if (!isArray(arrayLike)) {
			if ((getIterator = arrayLike[iteratorSymbol]) !== undefined) {
				// Source: Iterator
				iterator = callable(getIterator).call(arrayLike);
				if (Context) arr = new Context();
				result = iterator.next();
				i = 0;
				while (!result.done) {
					value = mapFn ? call.call(mapFn, thisArg, result.value, i) : result.value;
					if (Context) {
						desc.value = value;
						defineProperty(arr, i, desc);
					} else {
						arr[i] = value;
					}
					result = iterator.next();
					++i;
				}
				length = i;
			} else if (isString(arrayLike)) {
				// Source: String
				length = arrayLike.length;
				if (Context) arr = new Context();
				for (i = 0, j = 0; i < length; ++i) {
					value = arrayLike[i];
					if (i + 1 < length) {
						code = value.charCodeAt(0);
						// eslint-disable-next-line max-depth
						if (code >= 0xd800 && code <= 0xdbff) value += arrayLike[++i];
					}
					value = mapFn ? call.call(mapFn, thisArg, value, j) : value;
					if (Context) {
						desc.value = value;
						defineProperty(arr, j, desc);
					} else {
						arr[j] = value;
					}
					++j;
				}
				length = j;
			}
		}
		if (length === undefined) {
			// Source: array or array-like
			length = toPosInt(arrayLike.length);
			if (Context) arr = new Context(length);
			for (i = 0; i < length; ++i) {
				value = mapFn ? call.call(mapFn, thisArg, arrayLike[i], i) : arrayLike[i];
				if (Context) {
					desc.value = value;
					defineProperty(arr, i, desc);
				} else {
					arr[i] = value;
				}
			}
		}
		if (Context) {
			desc.value = null;
			arr.length = length;
		}
		return arr;
	};


/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var objToString = Object.prototype.toString, id = objToString.call(__webpack_require__(46));
	
	module.exports = function (value) {
		return typeof value === "function" && objToString.call(value) === id;
	};


/***/ }),
/* 94 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	var callable = __webpack_require__(61)
	  , forEach  = __webpack_require__(95)
	  , call     = Function.prototype.call;
	
	module.exports = function (obj, cb /*, thisArg*/) {
		var result = {}, thisArg = arguments[2];
		callable(cb);
		forEach(obj, function (value, key, targetObj, index) {
			result[key] = call.call(cb, thisArg, value, key, targetObj, index);
		});
		return result;
	};


/***/ }),
/* 95 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports = __webpack_require__(96)("forEach");


/***/ }),
/* 96 */
/***/ (function(module, exports, __webpack_require__) {

	// Internal method, used by iteration functions.
	// Calls a function for each key-value pair found in object
	// Optionally takes compareFn to iterate object in specific order
	
	"use strict";
	
	var callable                = __webpack_require__(61)
	  , value                   = __webpack_require__(44)
	  , bind                    = Function.prototype.bind
	  , call                    = Function.prototype.call
	  , keys                    = Object.keys
	  , objPropertyIsEnumerable = Object.prototype.propertyIsEnumerable;
	
	module.exports = function (method, defVal) {
		return function (obj, cb /*, thisArg, compareFn*/) {
			var list, thisArg = arguments[2], compareFn = arguments[3];
			obj = Object(value(obj));
			callable(cb);
	
			list = keys(obj);
			if (compareFn) {
				list.sort(typeof compareFn === "function" ? bind.call(compareFn, obj) : undefined);
			}
			if (typeof method !== "function") method = list[method];
			return call.call(method, list, function (key, index) {
				if (!objPropertyIsEnumerable.call(obj, key)) return defVal;
				return call.call(cb, thisArg, obj[key], key, obj, index);
			});
		};
	};


/***/ }),
/* 97 */
/***/ (function(module, exports, __webpack_require__) {

	// Thanks @mathiasbynens
	// http://mathiasbynens.be/notes/javascript-unicode#iterating-over-symbols
	
	"use strict";
	
	var setPrototypeOf = __webpack_require__(56)
	  , d              = __webpack_require__(62)
	  , Symbol         = __webpack_require__(75)
	  , Iterator       = __webpack_require__(87);
	
	var defineProperty = Object.defineProperty, StringIterator;
	
	StringIterator = module.exports = function (str) {
		if (!(this instanceof StringIterator)) throw new TypeError("Constructor requires 'new'");
		str = String(str);
		Iterator.call(this, str);
		defineProperty(this, "__length__", d("", str.length));
	};
	if (setPrototypeOf) setPrototypeOf(StringIterator, Iterator);
	
	// Internal %ArrayIteratorPrototype% doesn't expose its constructor
	delete StringIterator.prototype.constructor;
	
	StringIterator.prototype = Object.create(Iterator.prototype, {
		_next: d(function () {
			if (!this.__list__) return undefined;
			if (this.__nextIndex__ < this.__length__) return this.__nextIndex__++;
			this._unBind();
			return undefined;
		}),
		_resolve: d(function (i) {
			var char = this.__list__[i], code;
			if (this.__nextIndex__ === this.__length__) return char;
			code = char.charCodeAt(0);
			if (code >= 0xd800 && code <= 0xdbff) return char + this.__list__[this.__nextIndex__++];
			return char;
		})
	});
	defineProperty(StringIterator.prototype, Symbol.toStringTag, d("c", "String Iterator"));


/***/ }),
/* 98 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var setPrototypeOf    = __webpack_require__(56)
	  , d                 = __webpack_require__(62)
	  , Iterator          = __webpack_require__(87)
	  , toStringTagSymbol = __webpack_require__(75).toStringTag
	  , kinds             = __webpack_require__(99)
	
	  , defineProperties = Object.defineProperties
	  , unBind = Iterator.prototype._unBind
	  , MapIterator;
	
	MapIterator = module.exports = function (map, kind) {
		if (!(this instanceof MapIterator)) return new MapIterator(map, kind);
		Iterator.call(this, map.__mapKeysData__, map);
		if (!kind || !kinds[kind]) kind = 'key+value';
		defineProperties(this, {
			__kind__: d('', kind),
			__values__: d('w', map.__mapValuesData__)
		});
	};
	if (setPrototypeOf) setPrototypeOf(MapIterator, Iterator);
	
	MapIterator.prototype = Object.create(Iterator.prototype, {
		constructor: d(MapIterator),
		_resolve: d(function (i) {
			if (this.__kind__ === 'value') return this.__values__[i];
			if (this.__kind__ === 'key') return this.__list__[i];
			return [this.__list__[i], this.__values__[i]];
		}),
		_unBind: d(function () {
			this.__values__ = null;
			unBind.call(this);
		}),
		toString: d(function () { return '[object Map Iterator]'; })
	});
	Object.defineProperty(MapIterator.prototype, toStringTagSymbol,
		d('c', 'Map Iterator'));


/***/ }),
/* 99 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(100)('key',
		'value', 'key+value');


/***/ }),
/* 100 */
/***/ (function(module, exports) {

	"use strict";
	
	var forEach = Array.prototype.forEach, create = Object.create;
	
	// eslint-disable-next-line no-unused-vars
	module.exports = function (arg /*, …args*/) {
		var set = create(null);
		forEach.call(arguments, function (name) {
			set[name] = true;
		});
		return set;
	};


/***/ }),
/* 101 */
/***/ (function(module, exports) {

	// Exports true if environment provides native `Map` implementation,
	// whatever that is.
	
	'use strict';
	
	module.exports = (function () {
		if (typeof Map === 'undefined') return false;
		return (Object.prototype.toString.call(new Map()) === '[object Map]');
	}());


/***/ }),
/* 102 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	var xstream_1 = __webpack_require__(3);
	var adapt_1 = __webpack_require__(15);
	var SCOPE_PREFIX = '___';
	var MockedDOMSource = (function () {
	    function MockedDOMSource(_mockConfig) {
	        this._mockConfig = _mockConfig;
	        if (_mockConfig['elements']) {
	            this._elements = _mockConfig['elements'];
	        }
	        else {
	            this._elements = adapt_1.adapt(xstream_1.default.empty());
	        }
	    }
	    MockedDOMSource.prototype.elements = function () {
	        var out = this
	            ._elements;
	        out._isCycleSource = 'MockedDOM';
	        return out;
	    };
	    MockedDOMSource.prototype.events = function (eventType, options) {
	        var streamForEventType = this._mockConfig[eventType];
	        var out = adapt_1.adapt(streamForEventType || xstream_1.default.empty());
	        out._isCycleSource = 'MockedDOM';
	        return out;
	    };
	    MockedDOMSource.prototype.select = function (selector) {
	        var mockConfigForSelector = this._mockConfig[selector] || {};
	        return new MockedDOMSource(mockConfigForSelector);
	    };
	    MockedDOMSource.prototype.isolateSource = function (source, scope) {
	        return source.select('.' + SCOPE_PREFIX + scope);
	    };
	    MockedDOMSource.prototype.isolateSink = function (sink, scope) {
	        return sink.map(function (vnode) {
	            if (vnode.sel && vnode.sel.indexOf(SCOPE_PREFIX + scope) !== -1) {
	                return vnode;
	            }
	            else {
	                vnode.sel += "." + SCOPE_PREFIX + scope;
	                return vnode;
	            }
	        });
	    };
	    return MockedDOMSource;
	}());
	exports.MockedDOMSource = MockedDOMSource;
	function mockDOMSource(mockConfig) {
	    return new MockedDOMSource(mockConfig);
	}
	exports.mockDOMSource = mockDOMSource;
	//# sourceMappingURL=mockDOMSource.js.map

/***/ }),
/* 103 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	Object.defineProperty(exports, "__esModule", { value: true });
	// tslint:disable:max-file-line-count
	var h_1 = __webpack_require__(11);
	function isValidString(param) {
	    return typeof param === 'string' && param.length > 0;
	}
	function isSelector(param) {
	    return isValidString(param) && (param[0] === '.' || param[0] === '#');
	}
	function createTagFunction(tagName) {
	    return function hyperscript(a, b, c) {
	        var hasA = typeof a !== 'undefined';
	        var hasB = typeof b !== 'undefined';
	        var hasC = typeof c !== 'undefined';
	        if (isSelector(a)) {
	            if (hasB && hasC) {
	                return h_1.h(tagName + a, b, c);
	            }
	            else if (hasB) {
	                return h_1.h(tagName + a, b);
	            }
	            else {
	                return h_1.h(tagName + a, {});
	            }
	        }
	        else if (hasC) {
	            return h_1.h(tagName + a, b, c);
	        }
	        else if (hasB) {
	            return h_1.h(tagName, a, b);
	        }
	        else if (hasA) {
	            return h_1.h(tagName, a);
	        }
	        else {
	            return h_1.h(tagName, {});
	        }
	    };
	}
	var SVG_TAG_NAMES = [
	    'a',
	    'altGlyph',
	    'altGlyphDef',
	    'altGlyphItem',
	    'animate',
	    'animateColor',
	    'animateMotion',
	    'animateTransform',
	    'circle',
	    'clipPath',
	    'colorProfile',
	    'cursor',
	    'defs',
	    'desc',
	    'ellipse',
	    'feBlend',
	    'feColorMatrix',
	    'feComponentTransfer',
	    'feComposite',
	    'feConvolveMatrix',
	    'feDiffuseLighting',
	    'feDisplacementMap',
	    'feDistantLight',
	    'feFlood',
	    'feFuncA',
	    'feFuncB',
	    'feFuncG',
	    'feFuncR',
	    'feGaussianBlur',
	    'feImage',
	    'feMerge',
	    'feMergeNode',
	    'feMorphology',
	    'feOffset',
	    'fePointLight',
	    'feSpecularLighting',
	    'feSpotlight',
	    'feTile',
	    'feTurbulence',
	    'filter',
	    'font',
	    'fontFace',
	    'fontFaceFormat',
	    'fontFaceName',
	    'fontFaceSrc',
	    'fontFaceUri',
	    'foreignObject',
	    'g',
	    'glyph',
	    'glyphRef',
	    'hkern',
	    'image',
	    'line',
	    'linearGradient',
	    'marker',
	    'mask',
	    'metadata',
	    'missingGlyph',
	    'mpath',
	    'path',
	    'pattern',
	    'polygon',
	    'polyline',
	    'radialGradient',
	    'rect',
	    'script',
	    'set',
	    'stop',
	    'style',
	    'switch',
	    'symbol',
	    'text',
	    'textPath',
	    'title',
	    'tref',
	    'tspan',
	    'use',
	    'view',
	    'vkern',
	];
	var svg = createTagFunction('svg');
	SVG_TAG_NAMES.forEach(function (tag) {
	    svg[tag] = createTagFunction(tag);
	});
	var TAG_NAMES = [
	    'a',
	    'abbr',
	    'address',
	    'area',
	    'article',
	    'aside',
	    'audio',
	    'b',
	    'base',
	    'bdi',
	    'bdo',
	    'blockquote',
	    'body',
	    'br',
	    'button',
	    'canvas',
	    'caption',
	    'cite',
	    'code',
	    'col',
	    'colgroup',
	    'dd',
	    'del',
	    'dfn',
	    'dir',
	    'div',
	    'dl',
	    'dt',
	    'em',
	    'embed',
	    'fieldset',
	    'figcaption',
	    'figure',
	    'footer',
	    'form',
	    'h1',
	    'h2',
	    'h3',
	    'h4',
	    'h5',
	    'h6',
	    'head',
	    'header',
	    'hgroup',
	    'hr',
	    'html',
	    'i',
	    'iframe',
	    'img',
	    'input',
	    'ins',
	    'kbd',
	    'keygen',
	    'label',
	    'legend',
	    'li',
	    'link',
	    'main',
	    'map',
	    'mark',
	    'menu',
	    'meta',
	    'nav',
	    'noscript',
	    'object',
	    'ol',
	    'optgroup',
	    'option',
	    'p',
	    'param',
	    'pre',
	    'progress',
	    'q',
	    'rp',
	    'rt',
	    'ruby',
	    's',
	    'samp',
	    'script',
	    'section',
	    'select',
	    'small',
	    'source',
	    'span',
	    'strong',
	    'style',
	    'sub',
	    'sup',
	    'table',
	    'tbody',
	    'td',
	    'textarea',
	    'tfoot',
	    'th',
	    'thead',
	    'time',
	    'title',
	    'tr',
	    'u',
	    'ul',
	    'video',
	];
	var exported = {
	    SVG_TAG_NAMES: SVG_TAG_NAMES,
	    TAG_NAMES: TAG_NAMES,
	    svg: svg,
	    isSelector: isSelector,
	    createTagFunction: createTagFunction,
	};
	TAG_NAMES.forEach(function (n) {
	    exported[n] = createTagFunction(n);
	});
	exports.default = exported;
	//# sourceMappingURL=hyperscript-helpers.js.map

/***/ }),
/* 104 */
/***/ (function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.makeClearInputDriver = makeClearInputDriver;
	function makeClearInputDriver() {
	  function ClearInputDriver(elem$) {
	    elem$.addListener({
	      next: function next(elem) {
	        elem.value = '';
	      },
	      error: function error(err) {
	        console.error(err);
	      },
	      complete: function complete() {}
	    });
	  }
	  return ClearInputDriver;
	}

/***/ }),
/* 105 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.makeIPFSRoomDriver = makeIPFSRoomDriver;
	
	var _xstream = __webpack_require__(3);
	
	var _xstream2 = _interopRequireDefault(_xstream);
	
	var _adapt = __webpack_require__(15);
	
	var _ipfsPubsubRoom = __webpack_require__(106);
	
	var _ipfsPubsubRoom2 = _interopRequireDefault(_ipfsPubsubRoom);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function makeIPFSRoomDriver(roomName) {
	
	    function ipfsRoomDriver(outgoing$) {
	        //Bootstrap the IPFS node
	        var ipfs = new window.Ipfs({
	            repo: 'ipfs/pubsub-demo/' + Math.random(),
	            EXPERIMENTAL: {
	                pubsub: true // required, enables pubsub
	            },
	            config: {
	                Addresses: {
	                    Swarm: ['/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star']
	                }
	            }
	        });
	
	        outgoing$.addListener({
	            next: function next(outgoing) {
	                var room = (0, _ipfsPubsubRoom2.default)(ipfs, roomName);
	                room.broadcast(outgoing);
	            },
	            error: function error() {},
	            complete: function complete() {}
	        });
	
	        var incoming$ = _xstream2.default.create({
	            start: function start(listener) {
	                ipfs.once('ready', function () {
	                    var room = (0, _ipfsPubsubRoom2.default)(ipfs, roomName);
	                    room.on('message', function (message) {
	                        listener.next(message);
	                    });
	                });
	            },
	            stop: function stop() {}
	        });
	
	        return (0, _adapt.adapt)(incoming$);
	    }
	
	    return ipfsRoomDriver;
	}

/***/ }),
/* 106 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(Buffer) {'use strict'
	
	const diff = __webpack_require__(111)
	const EventEmitter = __webpack_require__(118)
	const timers = __webpack_require__(119)
	const clone = __webpack_require__(112)
	const pull = __webpack_require__(121)
	
	const PROTOCOL = __webpack_require__(152)
	const Connection = __webpack_require__(153)
	
	const DEFAULT_OPTIONS = {
	  pollInterval: 1000
	}
	
	module.exports = (ipfs, topic, options) => {
	  return new PubSubRoom(ipfs, topic, options)
	}
	
	class PubSubRoom extends EventEmitter {
	  constructor (ipfs, topic, options) {
	    super()
	    this._ipfs = ipfs
	    this._topic = topic
	    this._options = Object.assign({}, clone(DEFAULT_OPTIONS), clone(options))
	    this._peers = []
	    this._connections = {}
	
	    if (!this._ipfs.pubsub) {
	      throw new Error('This IPFS node does not have pubsub.')
	    }
	
	    // if (this._ipfs.isOnline()) {
	    //   this._start()
	    // }
	    // this._ipfs.on('ready', this._start.bind(this))
	
	    this._ipfs.on('stop', this.leave.bind(this))
	
	    this._start()
	  }
	
	  getPeers () {
	    return this._peers.slice(0)
	  }
	
	  hasPeer (peer) {
	    return this._peers.indexOf(peer) >= 0
	  }
	
	  leave () {
	    timers.clearInterval()
	    Object.keys(this._connections).forEach((peer) => {
	      this._connections[peer].stop()
	    })
	    this.emit('stop')
	  }
	
	  broadcast (_message) {
	    let message = _message
	    if (!Buffer.isBuffer(message)) {
	      message = Buffer.from(message)
	    }
	    this._ipfs.pubsub.publish(this._topic, message, (err) => {
	      if (err) {
	        this.emit('error', err)
	      }
	    })
	  }
	
	  sendTo (peer, message) {
	    let conn = this._connections[peer]
	    if (!conn) {
	      conn = new Connection(peer, this._ipfs, this)
	      conn.on('error', (err) => this.emit('error', err))
	    }
	    conn.push(message)
	  }
	
	  _start () {
	    this._interval = timers.setInterval(
	      this._pollPeers.bind(this),
	      this._options.pollInterval)
	
	    const listener = this._onMessage.bind(this)
	    this._ipfs.pubsub.subscribe(this._topic, listener, (err) => {
	      if (err) {
	        this.emit('error', err)
	      } else {
	        this.emit('subscribed', this._topic)
	      }
	    })
	
	    this.once('stop', () => {
	      this._ipfs.pubsub.unsubscribe(this._topic, listener)
	    })
	
	    this._ipfs._libp2pNode.handle(PROTOCOL, this._handleDirectConnection.bind(this))
	  }
	
	  _pollPeers () {
	    this._ipfs.pubsub.peers(this._topic, (err, _newPeers) => {
	      if (err) {
	        this.emit('error', err)
	        return // early
	      }
	
	      const newPeers = _newPeers.sort()
	
	      if (this._emitChanges(newPeers)) {
	        this._peers = newPeers
	      }
	    })
	  }
	
	  _emitChanges (newPeers) {
	    const differences = diff(this._peers, newPeers)
	
	    differences.added.forEach((addedPeer) => this.emit('peer joined', addedPeer))
	    differences.removed.forEach((removedPeer) => this.emit('peer left', removedPeer))
	
	    return differences.added.length > 0 || differences.removed.length > 0
	  }
	
	  _onMessage (message) {
	    this.emit('message', message)
	  }
	
	  _handleDirectConnection (protocol, conn) {
	    conn.getPeerInfo((err, peerInfo) => {
	      if (err) {
	        throw err
	      }
	
	      const peerId = peerInfo.id.toB58String()
	
	      pull(
	        conn,
	        pull.map((message) => {
	          this.emit('message', {
	            from: peerId,
	            data: message
	          })
	          return message
	        }),
	        pull.onEnd((err) => {
	          // do nothinfg
	          if (err) {
	            this.emit('warning', err)
	          }
	        })
	      )
	    })
	  }
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(107).Buffer))

/***/ }),
/* 107 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/*!
	 * The buffer module from node.js, for the browser.
	 *
	 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
	 * @license  MIT
	 */
	/* eslint-disable no-proto */
	
	'use strict'
	
	var base64 = __webpack_require__(108)
	var ieee754 = __webpack_require__(109)
	var isArray = __webpack_require__(110)
	
	exports.Buffer = Buffer
	exports.SlowBuffer = SlowBuffer
	exports.INSPECT_MAX_BYTES = 50
	
	/**
	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
	 *   === true    Use Uint8Array implementation (fastest)
	 *   === false   Use Object implementation (most compatible, even IE6)
	 *
	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
	 * Opera 11.6+, iOS 4.2+.
	 *
	 * Due to various browser bugs, sometimes the Object implementation will be used even
	 * when the browser supports typed arrays.
	 *
	 * Note:
	 *
	 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
	 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
	 *
	 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
	 *
	 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
	 *     incorrect length in some situations.
	
	 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
	 * get the Object implementation, which is slower but behaves correctly.
	 */
	Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
	  ? global.TYPED_ARRAY_SUPPORT
	  : typedArraySupport()
	
	/*
	 * Export kMaxLength after typed array support is determined.
	 */
	exports.kMaxLength = kMaxLength()
	
	function typedArraySupport () {
	  try {
	    var arr = new Uint8Array(1)
	    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
	    return arr.foo() === 42 && // typed array instances can be augmented
	        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
	        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
	  } catch (e) {
	    return false
	  }
	}
	
	function kMaxLength () {
	  return Buffer.TYPED_ARRAY_SUPPORT
	    ? 0x7fffffff
	    : 0x3fffffff
	}
	
	function createBuffer (that, length) {
	  if (kMaxLength() < length) {
	    throw new RangeError('Invalid typed array length')
	  }
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = new Uint8Array(length)
	    that.__proto__ = Buffer.prototype
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    if (that === null) {
	      that = new Buffer(length)
	    }
	    that.length = length
	  }
	
	  return that
	}
	
	/**
	 * The Buffer constructor returns instances of `Uint8Array` that have their
	 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
	 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
	 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
	 * returns a single octet.
	 *
	 * The `Uint8Array` prototype remains unmodified.
	 */
	
	function Buffer (arg, encodingOrOffset, length) {
	  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
	    return new Buffer(arg, encodingOrOffset, length)
	  }
	
	  // Common case.
	  if (typeof arg === 'number') {
	    if (typeof encodingOrOffset === 'string') {
	      throw new Error(
	        'If encoding is specified then the first argument must be a string'
	      )
	    }
	    return allocUnsafe(this, arg)
	  }
	  return from(this, arg, encodingOrOffset, length)
	}
	
	Buffer.poolSize = 8192 // not used by this implementation
	
	// TODO: Legacy, not needed anymore. Remove in next major version.
	Buffer._augment = function (arr) {
	  arr.__proto__ = Buffer.prototype
	  return arr
	}
	
	function from (that, value, encodingOrOffset, length) {
	  if (typeof value === 'number') {
	    throw new TypeError('"value" argument must not be a number')
	  }
	
	  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
	    return fromArrayBuffer(that, value, encodingOrOffset, length)
	  }
	
	  if (typeof value === 'string') {
	    return fromString(that, value, encodingOrOffset)
	  }
	
	  return fromObject(that, value)
	}
	
	/**
	 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
	 * if value is a number.
	 * Buffer.from(str[, encoding])
	 * Buffer.from(array)
	 * Buffer.from(buffer)
	 * Buffer.from(arrayBuffer[, byteOffset[, length]])
	 **/
	Buffer.from = function (value, encodingOrOffset, length) {
	  return from(null, value, encodingOrOffset, length)
	}
	
	if (Buffer.TYPED_ARRAY_SUPPORT) {
	  Buffer.prototype.__proto__ = Uint8Array.prototype
	  Buffer.__proto__ = Uint8Array
	  if (typeof Symbol !== 'undefined' && Symbol.species &&
	      Buffer[Symbol.species] === Buffer) {
	    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
	    Object.defineProperty(Buffer, Symbol.species, {
	      value: null,
	      configurable: true
	    })
	  }
	}
	
	function assertSize (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('"size" argument must be a number')
	  } else if (size < 0) {
	    throw new RangeError('"size" argument must not be negative')
	  }
	}
	
	function alloc (that, size, fill, encoding) {
	  assertSize(size)
	  if (size <= 0) {
	    return createBuffer(that, size)
	  }
	  if (fill !== undefined) {
	    // Only pay attention to encoding if it's a string. This
	    // prevents accidentally sending in a number that would
	    // be interpretted as a start offset.
	    return typeof encoding === 'string'
	      ? createBuffer(that, size).fill(fill, encoding)
	      : createBuffer(that, size).fill(fill)
	  }
	  return createBuffer(that, size)
	}
	
	/**
	 * Creates a new filled Buffer instance.
	 * alloc(size[, fill[, encoding]])
	 **/
	Buffer.alloc = function (size, fill, encoding) {
	  return alloc(null, size, fill, encoding)
	}
	
	function allocUnsafe (that, size) {
	  assertSize(size)
	  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) {
	    for (var i = 0; i < size; ++i) {
	      that[i] = 0
	    }
	  }
	  return that
	}
	
	/**
	 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
	 * */
	Buffer.allocUnsafe = function (size) {
	  return allocUnsafe(null, size)
	}
	/**
	 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
	 */
	Buffer.allocUnsafeSlow = function (size) {
	  return allocUnsafe(null, size)
	}
	
	function fromString (that, string, encoding) {
	  if (typeof encoding !== 'string' || encoding === '') {
	    encoding = 'utf8'
	  }
	
	  if (!Buffer.isEncoding(encoding)) {
	    throw new TypeError('"encoding" must be a valid string encoding')
	  }
	
	  var length = byteLength(string, encoding) | 0
	  that = createBuffer(that, length)
	
	  var actual = that.write(string, encoding)
	
	  if (actual !== length) {
	    // Writing a hex string, for example, that contains invalid characters will
	    // cause everything after the first invalid character to be ignored. (e.g.
	    // 'abxxcd' will be treated as 'ab')
	    that = that.slice(0, actual)
	  }
	
	  return that
	}
	
	function fromArrayLike (that, array) {
	  var length = array.length < 0 ? 0 : checked(array.length) | 0
	  that = createBuffer(that, length)
	  for (var i = 0; i < length; i += 1) {
	    that[i] = array[i] & 255
	  }
	  return that
	}
	
	function fromArrayBuffer (that, array, byteOffset, length) {
	  array.byteLength // this throws if `array` is not a valid ArrayBuffer
	
	  if (byteOffset < 0 || array.byteLength < byteOffset) {
	    throw new RangeError('\'offset\' is out of bounds')
	  }
	
	  if (array.byteLength < byteOffset + (length || 0)) {
	    throw new RangeError('\'length\' is out of bounds')
	  }
	
	  if (byteOffset === undefined && length === undefined) {
	    array = new Uint8Array(array)
	  } else if (length === undefined) {
	    array = new Uint8Array(array, byteOffset)
	  } else {
	    array = new Uint8Array(array, byteOffset, length)
	  }
	
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    // Return an augmented `Uint8Array` instance, for best performance
	    that = array
	    that.__proto__ = Buffer.prototype
	  } else {
	    // Fallback: Return an object instance of the Buffer class
	    that = fromArrayLike(that, array)
	  }
	  return that
	}
	
	function fromObject (that, obj) {
	  if (Buffer.isBuffer(obj)) {
	    var len = checked(obj.length) | 0
	    that = createBuffer(that, len)
	
	    if (that.length === 0) {
	      return that
	    }
	
	    obj.copy(that, 0, 0, len)
	    return that
	  }
	
	  if (obj) {
	    if ((typeof ArrayBuffer !== 'undefined' &&
	        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
	      if (typeof obj.length !== 'number' || isnan(obj.length)) {
	        return createBuffer(that, 0)
	      }
	      return fromArrayLike(that, obj)
	    }
	
	    if (obj.type === 'Buffer' && isArray(obj.data)) {
	      return fromArrayLike(that, obj.data)
	    }
	  }
	
	  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
	}
	
	function checked (length) {
	  // Note: cannot use `length < kMaxLength()` here because that fails when
	  // length is NaN (which is otherwise coerced to zero.)
	  if (length >= kMaxLength()) {
	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
	                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
	  }
	  return length | 0
	}
	
	function SlowBuffer (length) {
	  if (+length != length) { // eslint-disable-line eqeqeq
	    length = 0
	  }
	  return Buffer.alloc(+length)
	}
	
	Buffer.isBuffer = function isBuffer (b) {
	  return !!(b != null && b._isBuffer)
	}
	
	Buffer.compare = function compare (a, b) {
	  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
	    throw new TypeError('Arguments must be Buffers')
	  }
	
	  if (a === b) return 0
	
	  var x = a.length
	  var y = b.length
	
	  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
	    if (a[i] !== b[i]) {
	      x = a[i]
	      y = b[i]
	      break
	    }
	  }
	
	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	}
	
	Buffer.isEncoding = function isEncoding (encoding) {
	  switch (String(encoding).toLowerCase()) {
	    case 'hex':
	    case 'utf8':
	    case 'utf-8':
	    case 'ascii':
	    case 'latin1':
	    case 'binary':
	    case 'base64':
	    case 'ucs2':
	    case 'ucs-2':
	    case 'utf16le':
	    case 'utf-16le':
	      return true
	    default:
	      return false
	  }
	}
	
	Buffer.concat = function concat (list, length) {
	  if (!isArray(list)) {
	    throw new TypeError('"list" argument must be an Array of Buffers')
	  }
	
	  if (list.length === 0) {
	    return Buffer.alloc(0)
	  }
	
	  var i
	  if (length === undefined) {
	    length = 0
	    for (i = 0; i < list.length; ++i) {
	      length += list[i].length
	    }
	  }
	
	  var buffer = Buffer.allocUnsafe(length)
	  var pos = 0
	  for (i = 0; i < list.length; ++i) {
	    var buf = list[i]
	    if (!Buffer.isBuffer(buf)) {
	      throw new TypeError('"list" argument must be an Array of Buffers')
	    }
	    buf.copy(buffer, pos)
	    pos += buf.length
	  }
	  return buffer
	}
	
	function byteLength (string, encoding) {
	  if (Buffer.isBuffer(string)) {
	    return string.length
	  }
	  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
	      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
	    return string.byteLength
	  }
	  if (typeof string !== 'string') {
	    string = '' + string
	  }
	
	  var len = string.length
	  if (len === 0) return 0
	
	  // Use a for loop to avoid recursion
	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'ascii':
	      case 'latin1':
	      case 'binary':
	        return len
	      case 'utf8':
	      case 'utf-8':
	      case undefined:
	        return utf8ToBytes(string).length
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return len * 2
	      case 'hex':
	        return len >>> 1
	      case 'base64':
	        return base64ToBytes(string).length
	      default:
	        if (loweredCase) return utf8ToBytes(string).length // assume utf8
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}
	Buffer.byteLength = byteLength
	
	function slowToString (encoding, start, end) {
	  var loweredCase = false
	
	  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
	  // property of a typed array.
	
	  // This behaves neither like String nor Uint8Array in that we set start/end
	  // to their upper/lower bounds if the value passed is out of range.
	  // undefined is handled specially as per ECMA-262 6th Edition,
	  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
	  if (start === undefined || start < 0) {
	    start = 0
	  }
	  // Return early if start > this.length. Done here to prevent potential uint32
	  // coercion fail below.
	  if (start > this.length) {
	    return ''
	  }
	
	  if (end === undefined || end > this.length) {
	    end = this.length
	  }
	
	  if (end <= 0) {
	    return ''
	  }
	
	  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
	  end >>>= 0
	  start >>>= 0
	
	  if (end <= start) {
	    return ''
	  }
	
	  if (!encoding) encoding = 'utf8'
	
	  while (true) {
	    switch (encoding) {
	      case 'hex':
	        return hexSlice(this, start, end)
	
	      case 'utf8':
	      case 'utf-8':
	        return utf8Slice(this, start, end)
	
	      case 'ascii':
	        return asciiSlice(this, start, end)
	
	      case 'latin1':
	      case 'binary':
	        return latin1Slice(this, start, end)
	
	      case 'base64':
	        return base64Slice(this, start, end)
	
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return utf16leSlice(this, start, end)
	
	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = (encoding + '').toLowerCase()
	        loweredCase = true
	    }
	  }
	}
	
	// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
	// Buffer instances.
	Buffer.prototype._isBuffer = true
	
	function swap (b, n, m) {
	  var i = b[n]
	  b[n] = b[m]
	  b[m] = i
	}
	
	Buffer.prototype.swap16 = function swap16 () {
	  var len = this.length
	  if (len % 2 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 16-bits')
	  }
	  for (var i = 0; i < len; i += 2) {
	    swap(this, i, i + 1)
	  }
	  return this
	}
	
	Buffer.prototype.swap32 = function swap32 () {
	  var len = this.length
	  if (len % 4 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 32-bits')
	  }
	  for (var i = 0; i < len; i += 4) {
	    swap(this, i, i + 3)
	    swap(this, i + 1, i + 2)
	  }
	  return this
	}
	
	Buffer.prototype.swap64 = function swap64 () {
	  var len = this.length
	  if (len % 8 !== 0) {
	    throw new RangeError('Buffer size must be a multiple of 64-bits')
	  }
	  for (var i = 0; i < len; i += 8) {
	    swap(this, i, i + 7)
	    swap(this, i + 1, i + 6)
	    swap(this, i + 2, i + 5)
	    swap(this, i + 3, i + 4)
	  }
	  return this
	}
	
	Buffer.prototype.toString = function toString () {
	  var length = this.length | 0
	  if (length === 0) return ''
	  if (arguments.length === 0) return utf8Slice(this, 0, length)
	  return slowToString.apply(this, arguments)
	}
	
	Buffer.prototype.equals = function equals (b) {
	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
	  if (this === b) return true
	  return Buffer.compare(this, b) === 0
	}
	
	Buffer.prototype.inspect = function inspect () {
	  var str = ''
	  var max = exports.INSPECT_MAX_BYTES
	  if (this.length > 0) {
	    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
	    if (this.length > max) str += ' ... '
	  }
	  return '<Buffer ' + str + '>'
	}
	
	Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
	  if (!Buffer.isBuffer(target)) {
	    throw new TypeError('Argument must be a Buffer')
	  }
	
	  if (start === undefined) {
	    start = 0
	  }
	  if (end === undefined) {
	    end = target ? target.length : 0
	  }
	  if (thisStart === undefined) {
	    thisStart = 0
	  }
	  if (thisEnd === undefined) {
	    thisEnd = this.length
	  }
	
	  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
	    throw new RangeError('out of range index')
	  }
	
	  if (thisStart >= thisEnd && start >= end) {
	    return 0
	  }
	  if (thisStart >= thisEnd) {
	    return -1
	  }
	  if (start >= end) {
	    return 1
	  }
	
	  start >>>= 0
	  end >>>= 0
	  thisStart >>>= 0
	  thisEnd >>>= 0
	
	  if (this === target) return 0
	
	  var x = thisEnd - thisStart
	  var y = end - start
	  var len = Math.min(x, y)
	
	  var thisCopy = this.slice(thisStart, thisEnd)
	  var targetCopy = target.slice(start, end)
	
	  for (var i = 0; i < len; ++i) {
	    if (thisCopy[i] !== targetCopy[i]) {
	      x = thisCopy[i]
	      y = targetCopy[i]
	      break
	    }
	  }
	
	  if (x < y) return -1
	  if (y < x) return 1
	  return 0
	}
	
	// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
	// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
	//
	// Arguments:
	// - buffer - a Buffer to search
	// - val - a string, Buffer, or number
	// - byteOffset - an index into `buffer`; will be clamped to an int32
	// - encoding - an optional encoding, relevant is val is a string
	// - dir - true for indexOf, false for lastIndexOf
	function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
	  // Empty buffer means no match
	  if (buffer.length === 0) return -1
	
	  // Normalize byteOffset
	  if (typeof byteOffset === 'string') {
	    encoding = byteOffset
	    byteOffset = 0
	  } else if (byteOffset > 0x7fffffff) {
	    byteOffset = 0x7fffffff
	  } else if (byteOffset < -0x80000000) {
	    byteOffset = -0x80000000
	  }
	  byteOffset = +byteOffset  // Coerce to Number.
	  if (isNaN(byteOffset)) {
	    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
	    byteOffset = dir ? 0 : (buffer.length - 1)
	  }
	
	  // Normalize byteOffset: negative offsets start from the end of the buffer
	  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
	  if (byteOffset >= buffer.length) {
	    if (dir) return -1
	    else byteOffset = buffer.length - 1
	  } else if (byteOffset < 0) {
	    if (dir) byteOffset = 0
	    else return -1
	  }
	
	  // Normalize val
	  if (typeof val === 'string') {
	    val = Buffer.from(val, encoding)
	  }
	
	  // Finally, search either indexOf (if dir is true) or lastIndexOf
	  if (Buffer.isBuffer(val)) {
	    // Special case: looking for empty string/buffer always fails
	    if (val.length === 0) {
	      return -1
	    }
	    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
	  } else if (typeof val === 'number') {
	    val = val & 0xFF // Search for a byte value [0-255]
	    if (Buffer.TYPED_ARRAY_SUPPORT &&
	        typeof Uint8Array.prototype.indexOf === 'function') {
	      if (dir) {
	        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
	      } else {
	        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
	      }
	    }
	    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
	  }
	
	  throw new TypeError('val must be string, number or Buffer')
	}
	
	function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
	  var indexSize = 1
	  var arrLength = arr.length
	  var valLength = val.length
	
	  if (encoding !== undefined) {
	    encoding = String(encoding).toLowerCase()
	    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
	        encoding === 'utf16le' || encoding === 'utf-16le') {
	      if (arr.length < 2 || val.length < 2) {
	        return -1
	      }
	      indexSize = 2
	      arrLength /= 2
	      valLength /= 2
	      byteOffset /= 2
	    }
	  }
	
	  function read (buf, i) {
	    if (indexSize === 1) {
	      return buf[i]
	    } else {
	      return buf.readUInt16BE(i * indexSize)
	    }
	  }
	
	  var i
	  if (dir) {
	    var foundIndex = -1
	    for (i = byteOffset; i < arrLength; i++) {
	      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
	        if (foundIndex === -1) foundIndex = i
	        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
	      } else {
	        if (foundIndex !== -1) i -= i - foundIndex
	        foundIndex = -1
	      }
	    }
	  } else {
	    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
	    for (i = byteOffset; i >= 0; i--) {
	      var found = true
	      for (var j = 0; j < valLength; j++) {
	        if (read(arr, i + j) !== read(val, j)) {
	          found = false
	          break
	        }
	      }
	      if (found) return i
	    }
	  }
	
	  return -1
	}
	
	Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
	  return this.indexOf(val, byteOffset, encoding) !== -1
	}
	
	Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
	}
	
	Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
	  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
	}
	
	function hexWrite (buf, string, offset, length) {
	  offset = Number(offset) || 0
	  var remaining = buf.length - offset
	  if (!length) {
	    length = remaining
	  } else {
	    length = Number(length)
	    if (length > remaining) {
	      length = remaining
	    }
	  }
	
	  // must be an even number of digits
	  var strLen = string.length
	  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')
	
	  if (length > strLen / 2) {
	    length = strLen / 2
	  }
	  for (var i = 0; i < length; ++i) {
	    var parsed = parseInt(string.substr(i * 2, 2), 16)
	    if (isNaN(parsed)) return i
	    buf[offset + i] = parsed
	  }
	  return i
	}
	
	function utf8Write (buf, string, offset, length) {
	  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
	}
	
	function asciiWrite (buf, string, offset, length) {
	  return blitBuffer(asciiToBytes(string), buf, offset, length)
	}
	
	function latin1Write (buf, string, offset, length) {
	  return asciiWrite(buf, string, offset, length)
	}
	
	function base64Write (buf, string, offset, length) {
	  return blitBuffer(base64ToBytes(string), buf, offset, length)
	}
	
	function ucs2Write (buf, string, offset, length) {
	  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
	}
	
	Buffer.prototype.write = function write (string, offset, length, encoding) {
	  // Buffer#write(string)
	  if (offset === undefined) {
	    encoding = 'utf8'
	    length = this.length
	    offset = 0
	  // Buffer#write(string, encoding)
	  } else if (length === undefined && typeof offset === 'string') {
	    encoding = offset
	    length = this.length
	    offset = 0
	  // Buffer#write(string, offset[, length][, encoding])
	  } else if (isFinite(offset)) {
	    offset = offset | 0
	    if (isFinite(length)) {
	      length = length | 0
	      if (encoding === undefined) encoding = 'utf8'
	    } else {
	      encoding = length
	      length = undefined
	    }
	  // legacy write(string, encoding, offset, length) - remove in v0.13
	  } else {
	    throw new Error(
	      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
	    )
	  }
	
	  var remaining = this.length - offset
	  if (length === undefined || length > remaining) length = remaining
	
	  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
	    throw new RangeError('Attempt to write outside buffer bounds')
	  }
	
	  if (!encoding) encoding = 'utf8'
	
	  var loweredCase = false
	  for (;;) {
	    switch (encoding) {
	      case 'hex':
	        return hexWrite(this, string, offset, length)
	
	      case 'utf8':
	      case 'utf-8':
	        return utf8Write(this, string, offset, length)
	
	      case 'ascii':
	        return asciiWrite(this, string, offset, length)
	
	      case 'latin1':
	      case 'binary':
	        return latin1Write(this, string, offset, length)
	
	      case 'base64':
	        // Warning: maxLength not taken into account in base64Write
	        return base64Write(this, string, offset, length)
	
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return ucs2Write(this, string, offset, length)
	
	      default:
	        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
	        encoding = ('' + encoding).toLowerCase()
	        loweredCase = true
	    }
	  }
	}
	
	Buffer.prototype.toJSON = function toJSON () {
	  return {
	    type: 'Buffer',
	    data: Array.prototype.slice.call(this._arr || this, 0)
	  }
	}
	
	function base64Slice (buf, start, end) {
	  if (start === 0 && end === buf.length) {
	    return base64.fromByteArray(buf)
	  } else {
	    return base64.fromByteArray(buf.slice(start, end))
	  }
	}
	
	function utf8Slice (buf, start, end) {
	  end = Math.min(buf.length, end)
	  var res = []
	
	  var i = start
	  while (i < end) {
	    var firstByte = buf[i]
	    var codePoint = null
	    var bytesPerSequence = (firstByte > 0xEF) ? 4
	      : (firstByte > 0xDF) ? 3
	      : (firstByte > 0xBF) ? 2
	      : 1
	
	    if (i + bytesPerSequence <= end) {
	      var secondByte, thirdByte, fourthByte, tempCodePoint
	
	      switch (bytesPerSequence) {
	        case 1:
	          if (firstByte < 0x80) {
	            codePoint = firstByte
	          }
	          break
	        case 2:
	          secondByte = buf[i + 1]
	          if ((secondByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
	            if (tempCodePoint > 0x7F) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 3:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
	            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
	              codePoint = tempCodePoint
	            }
	          }
	          break
	        case 4:
	          secondByte = buf[i + 1]
	          thirdByte = buf[i + 2]
	          fourthByte = buf[i + 3]
	          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
	            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
	            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
	              codePoint = tempCodePoint
	            }
	          }
	      }
	    }
	
	    if (codePoint === null) {
	      // we did not generate a valid codePoint so insert a
	      // replacement char (U+FFFD) and advance only 1 byte
	      codePoint = 0xFFFD
	      bytesPerSequence = 1
	    } else if (codePoint > 0xFFFF) {
	      // encode to utf16 (surrogate pair dance)
	      codePoint -= 0x10000
	      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
	      codePoint = 0xDC00 | codePoint & 0x3FF
	    }
	
	    res.push(codePoint)
	    i += bytesPerSequence
	  }
	
	  return decodeCodePointsArray(res)
	}
	
	// Based on http://stackoverflow.com/a/22747272/680742, the browser with
	// the lowest limit is Chrome, with 0x10000 args.
	// We go 1 magnitude less, for safety
	var MAX_ARGUMENTS_LENGTH = 0x1000
	
	function decodeCodePointsArray (codePoints) {
	  var len = codePoints.length
	  if (len <= MAX_ARGUMENTS_LENGTH) {
	    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
	  }
	
	  // Decode in chunks to avoid "call stack size exceeded".
	  var res = ''
	  var i = 0
	  while (i < len) {
	    res += String.fromCharCode.apply(
	      String,
	      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
	    )
	  }
	  return res
	}
	
	function asciiSlice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)
	
	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i] & 0x7F)
	  }
	  return ret
	}
	
	function latin1Slice (buf, start, end) {
	  var ret = ''
	  end = Math.min(buf.length, end)
	
	  for (var i = start; i < end; ++i) {
	    ret += String.fromCharCode(buf[i])
	  }
	  return ret
	}
	
	function hexSlice (buf, start, end) {
	  var len = buf.length
	
	  if (!start || start < 0) start = 0
	  if (!end || end < 0 || end > len) end = len
	
	  var out = ''
	  for (var i = start; i < end; ++i) {
	    out += toHex(buf[i])
	  }
	  return out
	}
	
	function utf16leSlice (buf, start, end) {
	  var bytes = buf.slice(start, end)
	  var res = ''
	  for (var i = 0; i < bytes.length; i += 2) {
	    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
	  }
	  return res
	}
	
	Buffer.prototype.slice = function slice (start, end) {
	  var len = this.length
	  start = ~~start
	  end = end === undefined ? len : ~~end
	
	  if (start < 0) {
	    start += len
	    if (start < 0) start = 0
	  } else if (start > len) {
	    start = len
	  }
	
	  if (end < 0) {
	    end += len
	    if (end < 0) end = 0
	  } else if (end > len) {
	    end = len
	  }
	
	  if (end < start) end = start
	
	  var newBuf
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    newBuf = this.subarray(start, end)
	    newBuf.__proto__ = Buffer.prototype
	  } else {
	    var sliceLen = end - start
	    newBuf = new Buffer(sliceLen, undefined)
	    for (var i = 0; i < sliceLen; ++i) {
	      newBuf[i] = this[i + start]
	    }
	  }
	
	  return newBuf
	}
	
	/*
	 * Need to make sure that buffer isn't trying to write out of bounds.
	 */
	function checkOffset (offset, ext, length) {
	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
	}
	
	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)
	
	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }
	
	  return val
	}
	
	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    checkOffset(offset, byteLength, this.length)
	  }
	
	  var val = this[offset + --byteLength]
	  var mul = 1
	  while (byteLength > 0 && (mul *= 0x100)) {
	    val += this[offset + --byteLength] * mul
	  }
	
	  return val
	}
	
	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  return this[offset]
	}
	
	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return this[offset] | (this[offset + 1] << 8)
	}
	
	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  return (this[offset] << 8) | this[offset + 1]
	}
	
	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	
	  return ((this[offset]) |
	      (this[offset + 1] << 8) |
	      (this[offset + 2] << 16)) +
	      (this[offset + 3] * 0x1000000)
	}
	
	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	
	  return (this[offset] * 0x1000000) +
	    ((this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    this[offset + 3])
	}
	
	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)
	
	  var val = this[offset]
	  var mul = 1
	  var i = 0
	  while (++i < byteLength && (mul *= 0x100)) {
	    val += this[offset + i] * mul
	  }
	  mul *= 0x80
	
	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)
	
	  return val
	}
	
	Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) checkOffset(offset, byteLength, this.length)
	
	  var i = byteLength
	  var mul = 1
	  var val = this[offset + --i]
	  while (i > 0 && (mul *= 0x100)) {
	    val += this[offset + --i] * mul
	  }
	  mul *= 0x80
	
	  if (val >= mul) val -= Math.pow(2, 8 * byteLength)
	
	  return val
	}
	
	Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 1, this.length)
	  if (!(this[offset] & 0x80)) return (this[offset])
	  return ((0xff - this[offset] + 1) * -1)
	}
	
	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset] | (this[offset + 1] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}
	
	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 2, this.length)
	  var val = this[offset + 1] | (this[offset] << 8)
	  return (val & 0x8000) ? val | 0xFFFF0000 : val
	}
	
	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	
	  return (this[offset]) |
	    (this[offset + 1] << 8) |
	    (this[offset + 2] << 16) |
	    (this[offset + 3] << 24)
	}
	
	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	
	  return (this[offset] << 24) |
	    (this[offset + 1] << 16) |
	    (this[offset + 2] << 8) |
	    (this[offset + 3])
	}
	
	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, true, 23, 4)
	}
	
	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 4, this.length)
	  return ieee754.read(this, offset, false, 23, 4)
	}
	
	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, true, 52, 8)
	}
	
	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
	  if (!noAssert) checkOffset(offset, 8, this.length)
	  return ieee754.read(this, offset, false, 52, 8)
	}
	
	function checkInt (buf, value, offset, ext, max, min) {
	  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
	  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	}
	
	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1
	    checkInt(this, value, offset, byteLength, maxBytes, 0)
	  }
	
	  var mul = 1
	  var i = 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }
	
	  return offset + byteLength
	}
	
	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  byteLength = byteLength | 0
	  if (!noAssert) {
	    var maxBytes = Math.pow(2, 8 * byteLength) - 1
	    checkInt(this, value, offset, byteLength, maxBytes, 0)
	  }
	
	  var i = byteLength - 1
	  var mul = 1
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    this[offset + i] = (value / mul) & 0xFF
	  }
	
	  return offset + byteLength
	}
	
	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  this[offset] = (value & 0xff)
	  return offset + 1
	}
	
	function objectWriteUInt16 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
	    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
	      (littleEndian ? i : 1 - i) * 8
	  }
	}
	
	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}
	
	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = (value & 0xff)
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}
	
	function objectWriteUInt32 (buf, value, offset, littleEndian) {
	  if (value < 0) value = 0xffffffff + value + 1
	  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
	    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
	  }
	}
	
	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset + 3] = (value >>> 24)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 1] = (value >>> 8)
	    this[offset] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}
	
	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}
	
	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)
	
	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }
	
	  var i = 0
	  var mul = 1
	  var sub = 0
	  this[offset] = value & 0xFF
	  while (++i < byteLength && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
	      sub = 1
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }
	
	  return offset + byteLength
	}
	
	Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) {
	    var limit = Math.pow(2, 8 * byteLength - 1)
	
	    checkInt(this, value, offset, byteLength, limit - 1, -limit)
	  }
	
	  var i = byteLength - 1
	  var mul = 1
	  var sub = 0
	  this[offset + i] = value & 0xFF
	  while (--i >= 0 && (mul *= 0x100)) {
	    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
	      sub = 1
	    }
	    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
	  }
	
	  return offset + byteLength
	}
	
	Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
	  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
	  if (value < 0) value = 0xff + value + 1
	  this[offset] = (value & 0xff)
	  return offset + 1
	}
	
	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	  } else {
	    objectWriteUInt16(this, value, offset, true)
	  }
	  return offset + 2
	}
	
	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 8)
	    this[offset + 1] = (value & 0xff)
	  } else {
	    objectWriteUInt16(this, value, offset, false)
	  }
	  return offset + 2
	}
	
	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value & 0xff)
	    this[offset + 1] = (value >>> 8)
	    this[offset + 2] = (value >>> 16)
	    this[offset + 3] = (value >>> 24)
	  } else {
	    objectWriteUInt32(this, value, offset, true)
	  }
	  return offset + 4
	}
	
	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
	  value = +value
	  offset = offset | 0
	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
	  if (value < 0) value = 0xffffffff + value + 1
	  if (Buffer.TYPED_ARRAY_SUPPORT) {
	    this[offset] = (value >>> 24)
	    this[offset + 1] = (value >>> 16)
	    this[offset + 2] = (value >>> 8)
	    this[offset + 3] = (value & 0xff)
	  } else {
	    objectWriteUInt32(this, value, offset, false)
	  }
	  return offset + 4
	}
	
	function checkIEEE754 (buf, value, offset, ext, max, min) {
	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
	  if (offset < 0) throw new RangeError('Index out of range')
	}
	
	function writeFloat (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 23, 4)
	  return offset + 4
	}
	
	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, true, noAssert)
	}
	
	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
	  return writeFloat(this, value, offset, false, noAssert)
	}
	
	function writeDouble (buf, value, offset, littleEndian, noAssert) {
	  if (!noAssert) {
	    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
	  }
	  ieee754.write(buf, value, offset, littleEndian, 52, 8)
	  return offset + 8
	}
	
	Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, true, noAssert)
	}
	
	Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
	  return writeDouble(this, value, offset, false, noAssert)
	}
	
	// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
	Buffer.prototype.copy = function copy (target, targetStart, start, end) {
	  if (!start) start = 0
	  if (!end && end !== 0) end = this.length
	  if (targetStart >= target.length) targetStart = target.length
	  if (!targetStart) targetStart = 0
	  if (end > 0 && end < start) end = start
	
	  // Copy 0 bytes; we're done
	  if (end === start) return 0
	  if (target.length === 0 || this.length === 0) return 0
	
	  // Fatal error conditions
	  if (targetStart < 0) {
	    throw new RangeError('targetStart out of bounds')
	  }
	  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
	  if (end < 0) throw new RangeError('sourceEnd out of bounds')
	
	  // Are we oob?
	  if (end > this.length) end = this.length
	  if (target.length - targetStart < end - start) {
	    end = target.length - targetStart + start
	  }
	
	  var len = end - start
	  var i
	
	  if (this === target && start < targetStart && targetStart < end) {
	    // descending copy from end
	    for (i = len - 1; i >= 0; --i) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
	    // ascending copy from start
	    for (i = 0; i < len; ++i) {
	      target[i + targetStart] = this[i + start]
	    }
	  } else {
	    Uint8Array.prototype.set.call(
	      target,
	      this.subarray(start, start + len),
	      targetStart
	    )
	  }
	
	  return len
	}
	
	// Usage:
	//    buffer.fill(number[, offset[, end]])
	//    buffer.fill(buffer[, offset[, end]])
	//    buffer.fill(string[, offset[, end]][, encoding])
	Buffer.prototype.fill = function fill (val, start, end, encoding) {
	  // Handle string cases:
	  if (typeof val === 'string') {
	    if (typeof start === 'string') {
	      encoding = start
	      start = 0
	      end = this.length
	    } else if (typeof end === 'string') {
	      encoding = end
	      end = this.length
	    }
	    if (val.length === 1) {
	      var code = val.charCodeAt(0)
	      if (code < 256) {
	        val = code
	      }
	    }
	    if (encoding !== undefined && typeof encoding !== 'string') {
	      throw new TypeError('encoding must be a string')
	    }
	    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
	      throw new TypeError('Unknown encoding: ' + encoding)
	    }
	  } else if (typeof val === 'number') {
	    val = val & 255
	  }
	
	  // Invalid ranges are not set to a default, so can range check early.
	  if (start < 0 || this.length < start || this.length < end) {
	    throw new RangeError('Out of range index')
	  }
	
	  if (end <= start) {
	    return this
	  }
	
	  start = start >>> 0
	  end = end === undefined ? this.length : end >>> 0
	
	  if (!val) val = 0
	
	  var i
	  if (typeof val === 'number') {
	    for (i = start; i < end; ++i) {
	      this[i] = val
	    }
	  } else {
	    var bytes = Buffer.isBuffer(val)
	      ? val
	      : utf8ToBytes(new Buffer(val, encoding).toString())
	    var len = bytes.length
	    for (i = 0; i < end - start; ++i) {
	      this[i + start] = bytes[i % len]
	    }
	  }
	
	  return this
	}
	
	// HELPER FUNCTIONS
	// ================
	
	var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g
	
	function base64clean (str) {
	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
	  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
	  // Node converts strings with length < 2 to ''
	  if (str.length < 2) return ''
	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
	  while (str.length % 4 !== 0) {
	    str = str + '='
	  }
	  return str
	}
	
	function stringtrim (str) {
	  if (str.trim) return str.trim()
	  return str.replace(/^\s+|\s+$/g, '')
	}
	
	function toHex (n) {
	  if (n < 16) return '0' + n.toString(16)
	  return n.toString(16)
	}
	
	function utf8ToBytes (string, units) {
	  units = units || Infinity
	  var codePoint
	  var length = string.length
	  var leadSurrogate = null
	  var bytes = []
	
	  for (var i = 0; i < length; ++i) {
	    codePoint = string.charCodeAt(i)
	
	    // is surrogate component
	    if (codePoint > 0xD7FF && codePoint < 0xE000) {
	      // last char was a lead
	      if (!leadSurrogate) {
	        // no lead yet
	        if (codePoint > 0xDBFF) {
	          // unexpected trail
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        } else if (i + 1 === length) {
	          // unpaired lead
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	          continue
	        }
	
	        // valid lead
	        leadSurrogate = codePoint
	
	        continue
	      }
	
	      // 2 leads in a row
	      if (codePoint < 0xDC00) {
	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	        leadSurrogate = codePoint
	        continue
	      }
	
	      // valid surrogate pair
	      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
	    } else if (leadSurrogate) {
	      // valid bmp char, but last char was a lead
	      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
	    }
	
	    leadSurrogate = null
	
	    // encode utf8
	    if (codePoint < 0x80) {
	      if ((units -= 1) < 0) break
	      bytes.push(codePoint)
	    } else if (codePoint < 0x800) {
	      if ((units -= 2) < 0) break
	      bytes.push(
	        codePoint >> 0x6 | 0xC0,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x10000) {
	      if ((units -= 3) < 0) break
	      bytes.push(
	        codePoint >> 0xC | 0xE0,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else if (codePoint < 0x110000) {
	      if ((units -= 4) < 0) break
	      bytes.push(
	        codePoint >> 0x12 | 0xF0,
	        codePoint >> 0xC & 0x3F | 0x80,
	        codePoint >> 0x6 & 0x3F | 0x80,
	        codePoint & 0x3F | 0x80
	      )
	    } else {
	      throw new Error('Invalid code point')
	    }
	  }
	
	  return bytes
	}
	
	function asciiToBytes (str) {
	  var byteArray = []
	  for (var i = 0; i < str.length; ++i) {
	    // Node's code seems to be doing this and not & 0x7F..
	    byteArray.push(str.charCodeAt(i) & 0xFF)
	  }
	  return byteArray
	}
	
	function utf16leToBytes (str, units) {
	  var c, hi, lo
	  var byteArray = []
	  for (var i = 0; i < str.length; ++i) {
	    if ((units -= 2) < 0) break
	
	    c = str.charCodeAt(i)
	    hi = c >> 8
	    lo = c % 256
	    byteArray.push(lo)
	    byteArray.push(hi)
	  }
	
	  return byteArray
	}
	
	function base64ToBytes (str) {
	  return base64.toByteArray(base64clean(str))
	}
	
	function blitBuffer (src, dst, offset, length) {
	  for (var i = 0; i < length; ++i) {
	    if ((i + offset >= dst.length) || (i >= src.length)) break
	    dst[i + offset] = src[i]
	  }
	  return i
	}
	
	function isnan (val) {
	  return val !== val // eslint-disable-line no-self-compare
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 108 */
/***/ (function(module, exports) {

	'use strict'
	
	exports.byteLength = byteLength
	exports.toByteArray = toByteArray
	exports.fromByteArray = fromByteArray
	
	var lookup = []
	var revLookup = []
	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array
	
	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
	for (var i = 0, len = code.length; i < len; ++i) {
	  lookup[i] = code[i]
	  revLookup[code.charCodeAt(i)] = i
	}
	
	revLookup['-'.charCodeAt(0)] = 62
	revLookup['_'.charCodeAt(0)] = 63
	
	function placeHoldersCount (b64) {
	  var len = b64.length
	  if (len % 4 > 0) {
	    throw new Error('Invalid string. Length must be a multiple of 4')
	  }
	
	  // the number of equal signs (place holders)
	  // if there are two placeholders, than the two characters before it
	  // represent one byte
	  // if there is only one, then the three characters before it represent 2 bytes
	  // this is just a cheap hack to not do indexOf twice
	  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
	}
	
	function byteLength (b64) {
	  // base64 is 4/3 + up to two characters of the original data
	  return (b64.length * 3 / 4) - placeHoldersCount(b64)
	}
	
	function toByteArray (b64) {
	  var i, l, tmp, placeHolders, arr
	  var len = b64.length
	  placeHolders = placeHoldersCount(b64)
	
	  arr = new Arr((len * 3 / 4) - placeHolders)
	
	  // if there are placeholders, only get up to the last complete 4 chars
	  l = placeHolders > 0 ? len - 4 : len
	
	  var L = 0
	
	  for (i = 0; i < l; i += 4) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
	    arr[L++] = (tmp >> 16) & 0xFF
	    arr[L++] = (tmp >> 8) & 0xFF
	    arr[L++] = tmp & 0xFF
	  }
	
	  if (placeHolders === 2) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
	    arr[L++] = tmp & 0xFF
	  } else if (placeHolders === 1) {
	    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
	    arr[L++] = (tmp >> 8) & 0xFF
	    arr[L++] = tmp & 0xFF
	  }
	
	  return arr
	}
	
	function tripletToBase64 (num) {
	  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
	}
	
	function encodeChunk (uint8, start, end) {
	  var tmp
	  var output = []
	  for (var i = start; i < end; i += 3) {
	    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
	    output.push(tripletToBase64(tmp))
	  }
	  return output.join('')
	}
	
	function fromByteArray (uint8) {
	  var tmp
	  var len = uint8.length
	  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
	  var output = ''
	  var parts = []
	  var maxChunkLength = 16383 // must be multiple of 3
	
	  // go through the array every three bytes, we'll deal with trailing stuff later
	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
	    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
	  }
	
	  // pad the end with zeros, but make sure to not forget the extra bytes
	  if (extraBytes === 1) {
	    tmp = uint8[len - 1]
	    output += lookup[tmp >> 2]
	    output += lookup[(tmp << 4) & 0x3F]
	    output += '=='
	  } else if (extraBytes === 2) {
	    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
	    output += lookup[tmp >> 10]
	    output += lookup[(tmp >> 4) & 0x3F]
	    output += lookup[(tmp << 2) & 0x3F]
	    output += '='
	  }
	
	  parts.push(output)
	
	  return parts.join('')
	}


/***/ }),
/* 109 */
/***/ (function(module, exports) {

	exports.read = function (buffer, offset, isLE, mLen, nBytes) {
	  var e, m
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var nBits = -7
	  var i = isLE ? (nBytes - 1) : 0
	  var d = isLE ? -1 : 1
	  var s = buffer[offset + i]
	
	  i += d
	
	  e = s & ((1 << (-nBits)) - 1)
	  s >>= (-nBits)
	  nBits += eLen
	  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}
	
	  m = e & ((1 << (-nBits)) - 1)
	  e >>= (-nBits)
	  nBits += mLen
	  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}
	
	  if (e === 0) {
	    e = 1 - eBias
	  } else if (e === eMax) {
	    return m ? NaN : ((s ? -1 : 1) * Infinity)
	  } else {
	    m = m + Math.pow(2, mLen)
	    e = e - eBias
	  }
	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
	}
	
	exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c
	  var eLen = nBytes * 8 - mLen - 1
	  var eMax = (1 << eLen) - 1
	  var eBias = eMax >> 1
	  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
	  var i = isLE ? 0 : (nBytes - 1)
	  var d = isLE ? 1 : -1
	  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0
	
	  value = Math.abs(value)
	
	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0
	    e = eMax
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2)
	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--
	      c *= 2
	    }
	    if (e + eBias >= 1) {
	      value += rt / c
	    } else {
	      value += rt * Math.pow(2, 1 - eBias)
	    }
	    if (value * c >= 2) {
	      e++
	      c /= 2
	    }
	
	    if (e + eBias >= eMax) {
	      m = 0
	      e = eMax
	    } else if (e + eBias >= 1) {
	      m = (value * c - 1) * Math.pow(2, mLen)
	      e = e + eBias
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
	      e = 0
	    }
	  }
	
	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}
	
	  e = (e << mLen) | m
	  eLen += mLen
	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}
	
	  buffer[offset + i - d] |= s * 128
	}


/***/ }),
/* 110 */
/***/ (function(module, exports) {

	var toString = {}.toString;
	
	module.exports = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};


/***/ }),
/* 111 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	const cloneDeep = __webpack_require__(112)
	const debug = __webpack_require__(113)('hyperdiff')
	const pullAt = __webpack_require__(117)
	
	const isPresent = (itemIndex) => itemIndex !== -1
	
	function GET_INITIAL_STATE () {
	  return { common: [], removed: [] }
	}
	
	function hasItemWithProps (collection, item, props) {
	  return props.every(prop => item[prop] === collection[prop])
	}
	
	function indexOf (collection, item, props) {
	  return collection.indexOf(item)
	}
	
	function findIndexWithProps (collection, item, props) {
	  return collection.findIndex(function (origItem) {
	    return hasItemWithProps(origItem, item, props)
	  })
	}
	
	function determinateCollections (orig, dist) {
	  return {first: orig, second: cloneDeep(dist)}
	}
	
	function determinateFindIndex (props) {
	  return props ? findIndexWithProps : indexOf
	}
	
	function hyperdiff (orig, dist, props) {
	  const {first, second} = determinateCollections(orig, dist)
	  const findIndex = determinateFindIndex(props)
	  debug('preconditions first=%j second=%j findIndex=%s', first, second, findIndex.name)
	
	  const results = first.reduce(function (acc, item, index) {
	    const itemIndex = findIndex(second, item, props)
	    const destination = isPresent(itemIndex) ? 'common' : 'removed'
	    acc[destination].push(item)
	    pullAt(second, itemIndex)
	    debug('index=%s value=%s collection=%s', index, item, destination)
	    return acc
	  }, GET_INITIAL_STATE())
	
	  results.added = second
	  debug('added=%j removed=%j common%j', results.added, results.removed, results.common)
	  return results
	}
	
	module.exports = hyperdiff


/***/ }),
/* 112 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, module) {/**
	 * lodash (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
	 * Released under MIT license <https://lodash.com/license>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 */
	
	/** Used as the size to enable large array optimizations. */
	var LARGE_ARRAY_SIZE = 200;
	
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = '__lodash_hash_undefined__';
	
	/** Used as references for various `Number` constants. */
	var MAX_SAFE_INTEGER = 9007199254740991;
	
	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    arrayTag = '[object Array]',
	    boolTag = '[object Boolean]',
	    dateTag = '[object Date]',
	    errorTag = '[object Error]',
	    funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    mapTag = '[object Map]',
	    numberTag = '[object Number]',
	    objectTag = '[object Object]',
	    promiseTag = '[object Promise]',
	    regexpTag = '[object RegExp]',
	    setTag = '[object Set]',
	    stringTag = '[object String]',
	    symbolTag = '[object Symbol]',
	    weakMapTag = '[object WeakMap]';
	
	var arrayBufferTag = '[object ArrayBuffer]',
	    dataViewTag = '[object DataView]',
	    float32Tag = '[object Float32Array]',
	    float64Tag = '[object Float64Array]',
	    int8Tag = '[object Int8Array]',
	    int16Tag = '[object Int16Array]',
	    int32Tag = '[object Int32Array]',
	    uint8Tag = '[object Uint8Array]',
	    uint8ClampedTag = '[object Uint8ClampedArray]',
	    uint16Tag = '[object Uint16Array]',
	    uint32Tag = '[object Uint32Array]';
	
	/**
	 * Used to match `RegExp`
	 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	 */
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
	
	/** Used to match `RegExp` flags from their coerced string values. */
	var reFlags = /\w*$/;
	
	/** Used to detect host constructors (Safari). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;
	
	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;
	
	/** Used to identify `toStringTag` values supported by `_.clone`. */
	var cloneableTags = {};
	cloneableTags[argsTag] = cloneableTags[arrayTag] =
	cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
	cloneableTags[boolTag] = cloneableTags[dateTag] =
	cloneableTags[float32Tag] = cloneableTags[float64Tag] =
	cloneableTags[int8Tag] = cloneableTags[int16Tag] =
	cloneableTags[int32Tag] = cloneableTags[mapTag] =
	cloneableTags[numberTag] = cloneableTags[objectTag] =
	cloneableTags[regexpTag] = cloneableTags[setTag] =
	cloneableTags[stringTag] = cloneableTags[symbolTag] =
	cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
	cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
	cloneableTags[errorTag] = cloneableTags[funcTag] =
	cloneableTags[weakMapTag] = false;
	
	/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;
	
	/** Detect free variable `self`. */
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
	
	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function('return this')();
	
	/** Detect free variable `exports`. */
	var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;
	
	/** Detect free variable `module`. */
	var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;
	
	/** Detect the popular CommonJS extension `module.exports`. */
	var moduleExports = freeModule && freeModule.exports === freeExports;
	
	/**
	 * Adds the key-value `pair` to `map`.
	 *
	 * @private
	 * @param {Object} map The map to modify.
	 * @param {Array} pair The key-value pair to add.
	 * @returns {Object} Returns `map`.
	 */
	function addMapEntry(map, pair) {
	  // Don't return `map.set` because it's not chainable in IE 11.
	  map.set(pair[0], pair[1]);
	  return map;
	}
	
	/**
	 * Adds `value` to `set`.
	 *
	 * @private
	 * @param {Object} set The set to modify.
	 * @param {*} value The value to add.
	 * @returns {Object} Returns `set`.
	 */
	function addSetEntry(set, value) {
	  // Don't return `set.add` because it's not chainable in IE 11.
	  set.add(value);
	  return set;
	}
	
	/**
	 * A specialized version of `_.forEach` for arrays without support for
	 * iteratee shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns `array`.
	 */
	function arrayEach(array, iteratee) {
	  var index = -1,
	      length = array ? array.length : 0;
	
	  while (++index < length) {
	    if (iteratee(array[index], index, array) === false) {
	      break;
	    }
	  }
	  return array;
	}
	
	/**
	 * Appends the elements of `values` to `array`.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {Array} values The values to append.
	 * @returns {Array} Returns `array`.
	 */
	function arrayPush(array, values) {
	  var index = -1,
	      length = values.length,
	      offset = array.length;
	
	  while (++index < length) {
	    array[offset + index] = values[index];
	  }
	  return array;
	}
	
	/**
	 * A specialized version of `_.reduce` for arrays without support for
	 * iteratee shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @param {*} [accumulator] The initial value.
	 * @param {boolean} [initAccum] Specify using the first element of `array` as
	 *  the initial value.
	 * @returns {*} Returns the accumulated value.
	 */
	function arrayReduce(array, iteratee, accumulator, initAccum) {
	  var index = -1,
	      length = array ? array.length : 0;
	
	  if (initAccum && length) {
	    accumulator = array[++index];
	  }
	  while (++index < length) {
	    accumulator = iteratee(accumulator, array[index], index, array);
	  }
	  return accumulator;
	}
	
	/**
	 * The base implementation of `_.times` without support for iteratee shorthands
	 * or max array length checks.
	 *
	 * @private
	 * @param {number} n The number of times to invoke `iteratee`.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns the array of results.
	 */
	function baseTimes(n, iteratee) {
	  var index = -1,
	      result = Array(n);
	
	  while (++index < n) {
	    result[index] = iteratee(index);
	  }
	  return result;
	}
	
	/**
	 * Gets the value at `key` of `object`.
	 *
	 * @private
	 * @param {Object} [object] The object to query.
	 * @param {string} key The key of the property to get.
	 * @returns {*} Returns the property value.
	 */
	function getValue(object, key) {
	  return object == null ? undefined : object[key];
	}
	
	/**
	 * Checks if `value` is a host object in IE < 9.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
	 */
	function isHostObject(value) {
	  // Many host objects are `Object` objects that can coerce to strings
	  // despite having improperly defined `toString` methods.
	  var result = false;
	  if (value != null && typeof value.toString != 'function') {
	    try {
	      result = !!(value + '');
	    } catch (e) {}
	  }
	  return result;
	}
	
	/**
	 * Converts `map` to its key-value pairs.
	 *
	 * @private
	 * @param {Object} map The map to convert.
	 * @returns {Array} Returns the key-value pairs.
	 */
	function mapToArray(map) {
	  var index = -1,
	      result = Array(map.size);
	
	  map.forEach(function(value, key) {
	    result[++index] = [key, value];
	  });
	  return result;
	}
	
	/**
	 * Creates a unary function that invokes `func` with its argument transformed.
	 *
	 * @private
	 * @param {Function} func The function to wrap.
	 * @param {Function} transform The argument transform.
	 * @returns {Function} Returns the new function.
	 */
	function overArg(func, transform) {
	  return function(arg) {
	    return func(transform(arg));
	  };
	}
	
	/**
	 * Converts `set` to an array of its values.
	 *
	 * @private
	 * @param {Object} set The set to convert.
	 * @returns {Array} Returns the values.
	 */
	function setToArray(set) {
	  var index = -1,
	      result = Array(set.size);
	
	  set.forEach(function(value) {
	    result[++index] = value;
	  });
	  return result;
	}
	
	/** Used for built-in method references. */
	var arrayProto = Array.prototype,
	    funcProto = Function.prototype,
	    objectProto = Object.prototype;
	
	/** Used to detect overreaching core-js shims. */
	var coreJsData = root['__core-js_shared__'];
	
	/** Used to detect methods masquerading as native. */
	var maskSrcKey = (function() {
	  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
	  return uid ? ('Symbol(src)_1.' + uid) : '';
	}());
	
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);
	
	/** Built-in value references. */
	var Buffer = moduleExports ? root.Buffer : undefined,
	    Symbol = root.Symbol,
	    Uint8Array = root.Uint8Array,
	    getPrototype = overArg(Object.getPrototypeOf, Object),
	    objectCreate = Object.create,
	    propertyIsEnumerable = objectProto.propertyIsEnumerable,
	    splice = arrayProto.splice;
	
	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeGetSymbols = Object.getOwnPropertySymbols,
	    nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
	    nativeKeys = overArg(Object.keys, Object);
	
	/* Built-in method references that are verified to be native. */
	var DataView = getNative(root, 'DataView'),
	    Map = getNative(root, 'Map'),
	    Promise = getNative(root, 'Promise'),
	    Set = getNative(root, 'Set'),
	    WeakMap = getNative(root, 'WeakMap'),
	    nativeCreate = getNative(Object, 'create');
	
	/** Used to detect maps, sets, and weakmaps. */
	var dataViewCtorString = toSource(DataView),
	    mapCtorString = toSource(Map),
	    promiseCtorString = toSource(Promise),
	    setCtorString = toSource(Set),
	    weakMapCtorString = toSource(WeakMap);
	
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : undefined,
	    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;
	
	/**
	 * Creates a hash object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Hash(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	/**
	 * Removes all key-value entries from the hash.
	 *
	 * @private
	 * @name clear
	 * @memberOf Hash
	 */
	function hashClear() {
	  this.__data__ = nativeCreate ? nativeCreate(null) : {};
	}
	
	/**
	 * Removes `key` and its value from the hash.
	 *
	 * @private
	 * @name delete
	 * @memberOf Hash
	 * @param {Object} hash The hash to modify.
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function hashDelete(key) {
	  return this.has(key) && delete this.__data__[key];
	}
	
	/**
	 * Gets the hash value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Hash
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function hashGet(key) {
	  var data = this.__data__;
	  if (nativeCreate) {
	    var result = data[key];
	    return result === HASH_UNDEFINED ? undefined : result;
	  }
	  return hasOwnProperty.call(data, key) ? data[key] : undefined;
	}
	
	/**
	 * Checks if a hash value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Hash
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function hashHas(key) {
	  var data = this.__data__;
	  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
	}
	
	/**
	 * Sets the hash `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Hash
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the hash instance.
	 */
	function hashSet(key, value) {
	  var data = this.__data__;
	  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
	  return this;
	}
	
	// Add methods to `Hash`.
	Hash.prototype.clear = hashClear;
	Hash.prototype['delete'] = hashDelete;
	Hash.prototype.get = hashGet;
	Hash.prototype.has = hashHas;
	Hash.prototype.set = hashSet;
	
	/**
	 * Creates an list cache object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function ListCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	/**
	 * Removes all key-value entries from the list cache.
	 *
	 * @private
	 * @name clear
	 * @memberOf ListCache
	 */
	function listCacheClear() {
	  this.__data__ = [];
	}
	
	/**
	 * Removes `key` and its value from the list cache.
	 *
	 * @private
	 * @name delete
	 * @memberOf ListCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function listCacheDelete(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  if (index < 0) {
	    return false;
	  }
	  var lastIndex = data.length - 1;
	  if (index == lastIndex) {
	    data.pop();
	  } else {
	    splice.call(data, index, 1);
	  }
	  return true;
	}
	
	/**
	 * Gets the list cache value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf ListCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function listCacheGet(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  return index < 0 ? undefined : data[index][1];
	}
	
	/**
	 * Checks if a list cache value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf ListCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function listCacheHas(key) {
	  return assocIndexOf(this.__data__, key) > -1;
	}
	
	/**
	 * Sets the list cache `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf ListCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the list cache instance.
	 */
	function listCacheSet(key, value) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  if (index < 0) {
	    data.push([key, value]);
	  } else {
	    data[index][1] = value;
	  }
	  return this;
	}
	
	// Add methods to `ListCache`.
	ListCache.prototype.clear = listCacheClear;
	ListCache.prototype['delete'] = listCacheDelete;
	ListCache.prototype.get = listCacheGet;
	ListCache.prototype.has = listCacheHas;
	ListCache.prototype.set = listCacheSet;
	
	/**
	 * Creates a map cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function MapCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	/**
	 * Removes all key-value entries from the map.
	 *
	 * @private
	 * @name clear
	 * @memberOf MapCache
	 */
	function mapCacheClear() {
	  this.__data__ = {
	    'hash': new Hash,
	    'map': new (Map || ListCache),
	    'string': new Hash
	  };
	}
	
	/**
	 * Removes `key` and its value from the map.
	 *
	 * @private
	 * @name delete
	 * @memberOf MapCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function mapCacheDelete(key) {
	  return getMapData(this, key)['delete'](key);
	}
	
	/**
	 * Gets the map value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf MapCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function mapCacheGet(key) {
	  return getMapData(this, key).get(key);
	}
	
	/**
	 * Checks if a map value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf MapCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function mapCacheHas(key) {
	  return getMapData(this, key).has(key);
	}
	
	/**
	 * Sets the map `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf MapCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the map cache instance.
	 */
	function mapCacheSet(key, value) {
	  getMapData(this, key).set(key, value);
	  return this;
	}
	
	// Add methods to `MapCache`.
	MapCache.prototype.clear = mapCacheClear;
	MapCache.prototype['delete'] = mapCacheDelete;
	MapCache.prototype.get = mapCacheGet;
	MapCache.prototype.has = mapCacheHas;
	MapCache.prototype.set = mapCacheSet;
	
	/**
	 * Creates a stack cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Stack(entries) {
	  this.__data__ = new ListCache(entries);
	}
	
	/**
	 * Removes all key-value entries from the stack.
	 *
	 * @private
	 * @name clear
	 * @memberOf Stack
	 */
	function stackClear() {
	  this.__data__ = new ListCache;
	}
	
	/**
	 * Removes `key` and its value from the stack.
	 *
	 * @private
	 * @name delete
	 * @memberOf Stack
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function stackDelete(key) {
	  return this.__data__['delete'](key);
	}
	
	/**
	 * Gets the stack value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Stack
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function stackGet(key) {
	  return this.__data__.get(key);
	}
	
	/**
	 * Checks if a stack value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Stack
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function stackHas(key) {
	  return this.__data__.has(key);
	}
	
	/**
	 * Sets the stack `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Stack
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the stack cache instance.
	 */
	function stackSet(key, value) {
	  var cache = this.__data__;
	  if (cache instanceof ListCache) {
	    var pairs = cache.__data__;
	    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
	      pairs.push([key, value]);
	      return this;
	    }
	    cache = this.__data__ = new MapCache(pairs);
	  }
	  cache.set(key, value);
	  return this;
	}
	
	// Add methods to `Stack`.
	Stack.prototype.clear = stackClear;
	Stack.prototype['delete'] = stackDelete;
	Stack.prototype.get = stackGet;
	Stack.prototype.has = stackHas;
	Stack.prototype.set = stackSet;
	
	/**
	 * Creates an array of the enumerable property names of the array-like `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @param {boolean} inherited Specify returning inherited property names.
	 * @returns {Array} Returns the array of property names.
	 */
	function arrayLikeKeys(value, inherited) {
	  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
	  // Safari 9 makes `arguments.length` enumerable in strict mode.
	  var result = (isArray(value) || isArguments(value))
	    ? baseTimes(value.length, String)
	    : [];
	
	  var length = result.length,
	      skipIndexes = !!length;
	
	  for (var key in value) {
	    if ((inherited || hasOwnProperty.call(value, key)) &&
	        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
	      result.push(key);
	    }
	  }
	  return result;
	}
	
	/**
	 * Assigns `value` to `key` of `object` if the existing value is not equivalent
	 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * for equality comparisons.
	 *
	 * @private
	 * @param {Object} object The object to modify.
	 * @param {string} key The key of the property to assign.
	 * @param {*} value The value to assign.
	 */
	function assignValue(object, key, value) {
	  var objValue = object[key];
	  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
	      (value === undefined && !(key in object))) {
	    object[key] = value;
	  }
	}
	
	/**
	 * Gets the index at which the `key` is found in `array` of key-value pairs.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {*} key The key to search for.
	 * @returns {number} Returns the index of the matched value, else `-1`.
	 */
	function assocIndexOf(array, key) {
	  var length = array.length;
	  while (length--) {
	    if (eq(array[length][0], key)) {
	      return length;
	    }
	  }
	  return -1;
	}
	
	/**
	 * The base implementation of `_.assign` without support for multiple sources
	 * or `customizer` functions.
	 *
	 * @private
	 * @param {Object} object The destination object.
	 * @param {Object} source The source object.
	 * @returns {Object} Returns `object`.
	 */
	function baseAssign(object, source) {
	  return object && copyObject(source, keys(source), object);
	}
	
	/**
	 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
	 * traversed objects.
	 *
	 * @private
	 * @param {*} value The value to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @param {boolean} [isFull] Specify a clone including symbols.
	 * @param {Function} [customizer] The function to customize cloning.
	 * @param {string} [key] The key of `value`.
	 * @param {Object} [object] The parent object of `value`.
	 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
	 * @returns {*} Returns the cloned value.
	 */
	function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
	  var result;
	  if (customizer) {
	    result = object ? customizer(value, key, object, stack) : customizer(value);
	  }
	  if (result !== undefined) {
	    return result;
	  }
	  if (!isObject(value)) {
	    return value;
	  }
	  var isArr = isArray(value);
	  if (isArr) {
	    result = initCloneArray(value);
	    if (!isDeep) {
	      return copyArray(value, result);
	    }
	  } else {
	    var tag = getTag(value),
	        isFunc = tag == funcTag || tag == genTag;
	
	    if (isBuffer(value)) {
	      return cloneBuffer(value, isDeep);
	    }
	    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
	      if (isHostObject(value)) {
	        return object ? value : {};
	      }
	      result = initCloneObject(isFunc ? {} : value);
	      if (!isDeep) {
	        return copySymbols(value, baseAssign(result, value));
	      }
	    } else {
	      if (!cloneableTags[tag]) {
	        return object ? value : {};
	      }
	      result = initCloneByTag(value, tag, baseClone, isDeep);
	    }
	  }
	  // Check for circular references and return its corresponding clone.
	  stack || (stack = new Stack);
	  var stacked = stack.get(value);
	  if (stacked) {
	    return stacked;
	  }
	  stack.set(value, result);
	
	  if (!isArr) {
	    var props = isFull ? getAllKeys(value) : keys(value);
	  }
	  arrayEach(props || value, function(subValue, key) {
	    if (props) {
	      key = subValue;
	      subValue = value[key];
	    }
	    // Recursively populate clone (susceptible to call stack limits).
	    assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack));
	  });
	  return result;
	}
	
	/**
	 * The base implementation of `_.create` without support for assigning
	 * properties to the created object.
	 *
	 * @private
	 * @param {Object} prototype The object to inherit from.
	 * @returns {Object} Returns the new object.
	 */
	function baseCreate(proto) {
	  return isObject(proto) ? objectCreate(proto) : {};
	}
	
	/**
	 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
	 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
	 * symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Function} keysFunc The function to get the keys of `object`.
	 * @param {Function} symbolsFunc The function to get the symbols of `object`.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function baseGetAllKeys(object, keysFunc, symbolsFunc) {
	  var result = keysFunc(object);
	  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
	}
	
	/**
	 * The base implementation of `getTag`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	function baseGetTag(value) {
	  return objectToString.call(value);
	}
	
	/**
	 * The base implementation of `_.isNative` without bad shim checks.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function,
	 *  else `false`.
	 */
	function baseIsNative(value) {
	  if (!isObject(value) || isMasked(value)) {
	    return false;
	  }
	  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
	  return pattern.test(toSource(value));
	}
	
	/**
	 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 */
	function baseKeys(object) {
	  if (!isPrototype(object)) {
	    return nativeKeys(object);
	  }
	  var result = [];
	  for (var key in Object(object)) {
	    if (hasOwnProperty.call(object, key) && key != 'constructor') {
	      result.push(key);
	    }
	  }
	  return result;
	}
	
	/**
	 * Creates a clone of  `buffer`.
	 *
	 * @private
	 * @param {Buffer} buffer The buffer to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Buffer} Returns the cloned buffer.
	 */
	function cloneBuffer(buffer, isDeep) {
	  if (isDeep) {
	    return buffer.slice();
	  }
	  var result = new buffer.constructor(buffer.length);
	  buffer.copy(result);
	  return result;
	}
	
	/**
	 * Creates a clone of `arrayBuffer`.
	 *
	 * @private
	 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
	 * @returns {ArrayBuffer} Returns the cloned array buffer.
	 */
	function cloneArrayBuffer(arrayBuffer) {
	  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
	  new Uint8Array(result).set(new Uint8Array(arrayBuffer));
	  return result;
	}
	
	/**
	 * Creates a clone of `dataView`.
	 *
	 * @private
	 * @param {Object} dataView The data view to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned data view.
	 */
	function cloneDataView(dataView, isDeep) {
	  var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
	  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
	}
	
	/**
	 * Creates a clone of `map`.
	 *
	 * @private
	 * @param {Object} map The map to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned map.
	 */
	function cloneMap(map, isDeep, cloneFunc) {
	  var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
	  return arrayReduce(array, addMapEntry, new map.constructor);
	}
	
	/**
	 * Creates a clone of `regexp`.
	 *
	 * @private
	 * @param {Object} regexp The regexp to clone.
	 * @returns {Object} Returns the cloned regexp.
	 */
	function cloneRegExp(regexp) {
	  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
	  result.lastIndex = regexp.lastIndex;
	  return result;
	}
	
	/**
	 * Creates a clone of `set`.
	 *
	 * @private
	 * @param {Object} set The set to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned set.
	 */
	function cloneSet(set, isDeep, cloneFunc) {
	  var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
	  return arrayReduce(array, addSetEntry, new set.constructor);
	}
	
	/**
	 * Creates a clone of the `symbol` object.
	 *
	 * @private
	 * @param {Object} symbol The symbol object to clone.
	 * @returns {Object} Returns the cloned symbol object.
	 */
	function cloneSymbol(symbol) {
	  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
	}
	
	/**
	 * Creates a clone of `typedArray`.
	 *
	 * @private
	 * @param {Object} typedArray The typed array to clone.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the cloned typed array.
	 */
	function cloneTypedArray(typedArray, isDeep) {
	  var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
	  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
	}
	
	/**
	 * Copies the values of `source` to `array`.
	 *
	 * @private
	 * @param {Array} source The array to copy values from.
	 * @param {Array} [array=[]] The array to copy values to.
	 * @returns {Array} Returns `array`.
	 */
	function copyArray(source, array) {
	  var index = -1,
	      length = source.length;
	
	  array || (array = Array(length));
	  while (++index < length) {
	    array[index] = source[index];
	  }
	  return array;
	}
	
	/**
	 * Copies properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy properties from.
	 * @param {Array} props The property identifiers to copy.
	 * @param {Object} [object={}] The object to copy properties to.
	 * @param {Function} [customizer] The function to customize copied values.
	 * @returns {Object} Returns `object`.
	 */
	function copyObject(source, props, object, customizer) {
	  object || (object = {});
	
	  var index = -1,
	      length = props.length;
	
	  while (++index < length) {
	    var key = props[index];
	
	    var newValue = customizer
	      ? customizer(object[key], source[key], key, object, source)
	      : undefined;
	
	    assignValue(object, key, newValue === undefined ? source[key] : newValue);
	  }
	  return object;
	}
	
	/**
	 * Copies own symbol properties of `source` to `object`.
	 *
	 * @private
	 * @param {Object} source The object to copy symbols from.
	 * @param {Object} [object={}] The object to copy symbols to.
	 * @returns {Object} Returns `object`.
	 */
	function copySymbols(source, object) {
	  return copyObject(source, getSymbols(source), object);
	}
	
	/**
	 * Creates an array of own enumerable property names and symbols of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names and symbols.
	 */
	function getAllKeys(object) {
	  return baseGetAllKeys(object, keys, getSymbols);
	}
	
	/**
	 * Gets the data for `map`.
	 *
	 * @private
	 * @param {Object} map The map to query.
	 * @param {string} key The reference key.
	 * @returns {*} Returns the map data.
	 */
	function getMapData(map, key) {
	  var data = map.__data__;
	  return isKeyable(key)
	    ? data[typeof key == 'string' ? 'string' : 'hash']
	    : data.map;
	}
	
	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = getValue(object, key);
	  return baseIsNative(value) ? value : undefined;
	}
	
	/**
	 * Creates an array of the own enumerable symbol properties of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of symbols.
	 */
	var getSymbols = nativeGetSymbols ? overArg(nativeGetSymbols, Object) : stubArray;
	
	/**
	 * Gets the `toStringTag` of `value`.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	var getTag = baseGetTag;
	
	// Fallback for data views, maps, sets, and weak maps in IE 11,
	// for data views in Edge < 14, and promises in Node.js.
	if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
	    (Map && getTag(new Map) != mapTag) ||
	    (Promise && getTag(Promise.resolve()) != promiseTag) ||
	    (Set && getTag(new Set) != setTag) ||
	    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
	  getTag = function(value) {
	    var result = objectToString.call(value),
	        Ctor = result == objectTag ? value.constructor : undefined,
	        ctorString = Ctor ? toSource(Ctor) : undefined;
	
	    if (ctorString) {
	      switch (ctorString) {
	        case dataViewCtorString: return dataViewTag;
	        case mapCtorString: return mapTag;
	        case promiseCtorString: return promiseTag;
	        case setCtorString: return setTag;
	        case weakMapCtorString: return weakMapTag;
	      }
	    }
	    return result;
	  };
	}
	
	/**
	 * Initializes an array clone.
	 *
	 * @private
	 * @param {Array} array The array to clone.
	 * @returns {Array} Returns the initialized clone.
	 */
	function initCloneArray(array) {
	  var length = array.length,
	      result = array.constructor(length);
	
	  // Add properties assigned by `RegExp#exec`.
	  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
	    result.index = array.index;
	    result.input = array.input;
	  }
	  return result;
	}
	
	/**
	 * Initializes an object clone.
	 *
	 * @private
	 * @param {Object} object The object to clone.
	 * @returns {Object} Returns the initialized clone.
	 */
	function initCloneObject(object) {
	  return (typeof object.constructor == 'function' && !isPrototype(object))
	    ? baseCreate(getPrototype(object))
	    : {};
	}
	
	/**
	 * Initializes an object clone based on its `toStringTag`.
	 *
	 * **Note:** This function only supports cloning values with tags of
	 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	 *
	 * @private
	 * @param {Object} object The object to clone.
	 * @param {string} tag The `toStringTag` of the object to clone.
	 * @param {Function} cloneFunc The function to clone values.
	 * @param {boolean} [isDeep] Specify a deep clone.
	 * @returns {Object} Returns the initialized clone.
	 */
	function initCloneByTag(object, tag, cloneFunc, isDeep) {
	  var Ctor = object.constructor;
	  switch (tag) {
	    case arrayBufferTag:
	      return cloneArrayBuffer(object);
	
	    case boolTag:
	    case dateTag:
	      return new Ctor(+object);
	
	    case dataViewTag:
	      return cloneDataView(object, isDeep);
	
	    case float32Tag: case float64Tag:
	    case int8Tag: case int16Tag: case int32Tag:
	    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
	      return cloneTypedArray(object, isDeep);
	
	    case mapTag:
	      return cloneMap(object, isDeep, cloneFunc);
	
	    case numberTag:
	    case stringTag:
	      return new Ctor(object);
	
	    case regexpTag:
	      return cloneRegExp(object);
	
	    case setTag:
	      return cloneSet(object, isDeep, cloneFunc);
	
	    case symbolTag:
	      return cloneSymbol(object);
	  }
	}
	
	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return !!length &&
	    (typeof value == 'number' || reIsUint.test(value)) &&
	    (value > -1 && value % 1 == 0 && value < length);
	}
	
	/**
	 * Checks if `value` is suitable for use as unique object key.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	 */
	function isKeyable(value) {
	  var type = typeof value;
	  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
	    ? (value !== '__proto__')
	    : (value === null);
	}
	
	/**
	 * Checks if `func` has its source masked.
	 *
	 * @private
	 * @param {Function} func The function to check.
	 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
	 */
	function isMasked(func) {
	  return !!maskSrcKey && (maskSrcKey in func);
	}
	
	/**
	 * Checks if `value` is likely a prototype object.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	 */
	function isPrototype(value) {
	  var Ctor = value && value.constructor,
	      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;
	
	  return value === proto;
	}
	
	/**
	 * Converts `func` to its source code.
	 *
	 * @private
	 * @param {Function} func The function to process.
	 * @returns {string} Returns the source code.
	 */
	function toSource(func) {
	  if (func != null) {
	    try {
	      return funcToString.call(func);
	    } catch (e) {}
	    try {
	      return (func + '');
	    } catch (e) {}
	  }
	  return '';
	}
	
	/**
	 * This method is like `_.clone` except that it recursively clones `value`.
	 *
	 * @static
	 * @memberOf _
	 * @since 1.0.0
	 * @category Lang
	 * @param {*} value The value to recursively clone.
	 * @returns {*} Returns the deep cloned value.
	 * @see _.clone
	 * @example
	 *
	 * var objects = [{ 'a': 1 }, { 'b': 2 }];
	 *
	 * var deep = _.cloneDeep(objects);
	 * console.log(deep[0] === objects[0]);
	 * // => false
	 */
	function cloneDeep(value) {
	  return baseClone(value, true, true);
	}
	
	/**
	 * Performs a
	 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'a': 1 };
	 * var other = { 'a': 1 };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}
	
	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	function isArguments(value) {
	  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
	  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
	    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
	}
	
	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(document.body.children);
	 * // => false
	 *
	 * _.isArray('abc');
	 * // => false
	 *
	 * _.isArray(_.noop);
	 * // => false
	 */
	var isArray = Array.isArray;
	
	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null && isLength(value.length) && !isFunction(value);
	}
	
	/**
	 * This method is like `_.isArrayLike` except that it also checks if `value`
	 * is an object.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array-like object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArrayLikeObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLikeObject(document.body.children);
	 * // => true
	 *
	 * _.isArrayLikeObject('abc');
	 * // => false
	 *
	 * _.isArrayLikeObject(_.noop);
	 * // => false
	 */
	function isArrayLikeObject(value) {
	  return isObjectLike(value) && isArrayLike(value);
	}
	
	/**
	 * Checks if `value` is a buffer.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.3.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
	 * @example
	 *
	 * _.isBuffer(new Buffer(2));
	 * // => true
	 *
	 * _.isBuffer(new Uint8Array(2));
	 * // => false
	 */
	var isBuffer = nativeIsBuffer || stubFalse;
	
	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8-9 which returns 'object' for typed array and other constructors.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}
	
	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This method is loosely based on
	 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' &&
	    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}
	
	/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}
	
	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}
	
	/**
	 * Creates an array of the own enumerable property names of `object`.
	 *
	 * **Note:** Non-object values are coerced to objects. See the
	 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	 * for more details.
	 *
	 * @static
	 * @since 0.1.0
	 * @memberOf _
	 * @category Object
	 * @param {Object} object The object to query.
	 * @returns {Array} Returns the array of property names.
	 * @example
	 *
	 * function Foo() {
	 *   this.a = 1;
	 *   this.b = 2;
	 * }
	 *
	 * Foo.prototype.c = 3;
	 *
	 * _.keys(new Foo);
	 * // => ['a', 'b'] (iteration order is not guaranteed)
	 *
	 * _.keys('hi');
	 * // => ['0', '1']
	 */
	function keys(object) {
	  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
	}
	
	/**
	 * This method returns a new empty array.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {Array} Returns the new empty array.
	 * @example
	 *
	 * var arrays = _.times(2, _.stubArray);
	 *
	 * console.log(arrays);
	 * // => [[], []]
	 *
	 * console.log(arrays[0] === arrays[1]);
	 * // => false
	 */
	function stubArray() {
	  return [];
	}
	
	/**
	 * This method returns `false`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.13.0
	 * @category Util
	 * @returns {boolean} Returns `false`.
	 * @example
	 *
	 * _.times(2, _.stubFalse);
	 * // => [false, false]
	 */
	function stubFalse() {
	  return false;
	}
	
	module.exports = cloneDeep;
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(6)(module)))

/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * This is the web browser implementation of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = __webpack_require__(115);
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.storage = 'undefined' != typeof chrome
	               && 'undefined' != typeof chrome.storage
	                  ? chrome.storage.local
	                  : localstorage();
	
	/**
	 * Colors.
	 */
	
	exports.colors = [
	  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
	  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
	  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
	  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
	  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
	  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
	  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
	  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
	  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
	  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
	  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
	];
	
	/**
	 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
	 * and the Firebug extension (any Firefox version) are known
	 * to support "%c" CSS customizations.
	 *
	 * TODO: add a `localStorage` variable to explicitly enable/disable colors
	 */
	
	function useColors() {
	  // NB: In an Electron preload script, document will be defined but not fully
	  // initialized. Since we know we're in Chrome, we'll just detect this case
	  // explicitly
	  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
	    return true;
	  }
	
	  // Internet Explorer and Edge do not support colors.
	  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
	    return false;
	  }
	
	  // is webkit? http://stackoverflow.com/a/16459606/376773
	  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
	    // is firebug? http://stackoverflow.com/a/398120/376773
	    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
	    // is firefox >= v31?
	    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
	    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
	    // double check webkit in userAgent just in case we are in a worker
	    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
	}
	
	/**
	 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	 */
	
	exports.formatters.j = function(v) {
	  try {
	    return JSON.stringify(v);
	  } catch (err) {
	    return '[UnexpectedJSONParseError]: ' + err.message;
	  }
	};
	
	
	/**
	 * Colorize log arguments if enabled.
	 *
	 * @api public
	 */
	
	function formatArgs(args) {
	  var useColors = this.useColors;
	
	  args[0] = (useColors ? '%c' : '')
	    + this.namespace
	    + (useColors ? ' %c' : ' ')
	    + args[0]
	    + (useColors ? '%c ' : ' ')
	    + '+' + exports.humanize(this.diff);
	
	  if (!useColors) return;
	
	  var c = 'color: ' + this.color;
	  args.splice(1, 0, c, 'color: inherit')
	
	  // the final "%c" is somewhat tricky, because there could be other
	  // arguments passed either before or after the %c, so we need to
	  // figure out the correct index to insert the CSS into
	  var index = 0;
	  var lastC = 0;
	  args[0].replace(/%[a-zA-Z%]/g, function(match) {
	    if ('%%' === match) return;
	    index++;
	    if ('%c' === match) {
	      // we only are interested in the *last* %c
	      // (the user may have provided their own)
	      lastC = index;
	    }
	  });
	
	  args.splice(lastC, 0, c);
	}
	
	/**
	 * Invokes `console.log()` when available.
	 * No-op when `console.log` is not a "function".
	 *
	 * @api public
	 */
	
	function log() {
	  // this hackery is required for IE8/9, where
	  // the `console.log` function doesn't have 'apply'
	  return 'object' === typeof console
	    && console.log
	    && Function.prototype.apply.call(console.log, console, arguments);
	}
	
	/**
	 * Save `namespaces`.
	 *
	 * @param {String} namespaces
	 * @api private
	 */
	
	function save(namespaces) {
	  try {
	    if (null == namespaces) {
	      exports.storage.removeItem('debug');
	    } else {
	      exports.storage.debug = namespaces;
	    }
	  } catch(e) {}
	}
	
	/**
	 * Load `namespaces`.
	 *
	 * @return {String} returns the previously persisted debug modes
	 * @api private
	 */
	
	function load() {
	  var r;
	  try {
	    r = exports.storage.debug;
	  } catch(e) {}
	
	  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	  if (!r && typeof process !== 'undefined' && 'env' in process) {
	    r = process.env.DEBUG;
	  }
	
	  return r;
	}
	
	/**
	 * Enable namespaces listed in `localStorage.debug` initially.
	 */
	
	exports.enable(load());
	
	/**
	 * Localstorage attempts to return the localstorage.
	 *
	 * This is necessary because safari throws
	 * when a user disables cookies/localstorage
	 * and you attempt to access it.
	 *
	 * @return {LocalStorage}
	 * @api private
	 */
	
	function localstorage() {
	  try {
	    return window.localStorage;
	  } catch (e) {}
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(114)))

/***/ }),
/* 114 */
/***/ (function(module, exports) {

	// shim for using process in browser
	var process = module.exports = {};
	
	// cached from whatever global is present so that test runners that stub it
	// don't break things.  But we need to wrap it in a try catch in case it is
	// wrapped in strict mode code which doesn't define any globals.  It's inside a
	// function because try/catches deoptimize in certain engines.
	
	var cachedSetTimeout;
	var cachedClearTimeout;
	
	function defaultSetTimout() {
	    throw new Error('setTimeout has not been defined');
	}
	function defaultClearTimeout () {
	    throw new Error('clearTimeout has not been defined');
	}
	(function () {
	    try {
	        if (typeof setTimeout === 'function') {
	            cachedSetTimeout = setTimeout;
	        } else {
	            cachedSetTimeout = defaultSetTimout;
	        }
	    } catch (e) {
	        cachedSetTimeout = defaultSetTimout;
	    }
	    try {
	        if (typeof clearTimeout === 'function') {
	            cachedClearTimeout = clearTimeout;
	        } else {
	            cachedClearTimeout = defaultClearTimeout;
	        }
	    } catch (e) {
	        cachedClearTimeout = defaultClearTimeout;
	    }
	} ())
	function runTimeout(fun) {
	    if (cachedSetTimeout === setTimeout) {
	        //normal enviroments in sane situations
	        return setTimeout(fun, 0);
	    }
	    // if setTimeout wasn't available but was latter defined
	    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
	        cachedSetTimeout = setTimeout;
	        return setTimeout(fun, 0);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedSetTimeout(fun, 0);
	    } catch(e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
	            return cachedSetTimeout.call(null, fun, 0);
	        } catch(e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
	            return cachedSetTimeout.call(this, fun, 0);
	        }
	    }
	
	
	}
	function runClearTimeout(marker) {
	    if (cachedClearTimeout === clearTimeout) {
	        //normal enviroments in sane situations
	        return clearTimeout(marker);
	    }
	    // if clearTimeout wasn't available but was latter defined
	    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
	        cachedClearTimeout = clearTimeout;
	        return clearTimeout(marker);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedClearTimeout(marker);
	    } catch (e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
	            return cachedClearTimeout.call(null, marker);
	        } catch (e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
	            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
	            return cachedClearTimeout.call(this, marker);
	        }
	    }
	
	
	
	}
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;
	
	function cleanUpNextTick() {
	    if (!draining || !currentQueue) {
	        return;
	    }
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}
	
	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = runTimeout(cleanUpNextTick);
	    draining = true;
	
	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    runClearTimeout(timeout);
	}
	
	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        runTimeout(drainQueue);
	    }
	};
	
	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};
	
	function noop() {}
	
	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;
	process.prependListener = noop;
	process.prependOnceListener = noop;
	
	process.listeners = function (name) { return [] }
	
	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};
	
	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ }),
/* 115 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * This is the common logic for both the Node.js and web browser
	 * implementations of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
	exports.coerce = coerce;
	exports.disable = disable;
	exports.enable = enable;
	exports.enabled = enabled;
	exports.humanize = __webpack_require__(116);
	
	/**
	 * Active `debug` instances.
	 */
	exports.instances = [];
	
	/**
	 * The currently active debug mode names, and names to skip.
	 */
	
	exports.names = [];
	exports.skips = [];
	
	/**
	 * Map of special "%n" handling functions, for the debug "format" argument.
	 *
	 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	 */
	
	exports.formatters = {};
	
	/**
	 * Select a color.
	 * @param {String} namespace
	 * @return {Number}
	 * @api private
	 */
	
	function selectColor(namespace) {
	  var hash = 0, i;
	
	  for (i in namespace) {
	    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
	    hash |= 0; // Convert to 32bit integer
	  }
	
	  return exports.colors[Math.abs(hash) % exports.colors.length];
	}
	
	/**
	 * Create a debugger with the given `namespace`.
	 *
	 * @param {String} namespace
	 * @return {Function}
	 * @api public
	 */
	
	function createDebug(namespace) {
	
	  var prevTime;
	
	  function debug() {
	    // disabled?
	    if (!debug.enabled) return;
	
	    var self = debug;
	
	    // set `diff` timestamp
	    var curr = +new Date();
	    var ms = curr - (prevTime || curr);
	    self.diff = ms;
	    self.prev = prevTime;
	    self.curr = curr;
	    prevTime = curr;
	
	    // turn the `arguments` into a proper Array
	    var args = new Array(arguments.length);
	    for (var i = 0; i < args.length; i++) {
	      args[i] = arguments[i];
	    }
	
	    args[0] = exports.coerce(args[0]);
	
	    if ('string' !== typeof args[0]) {
	      // anything else let's inspect with %O
	      args.unshift('%O');
	    }
	
	    // apply any `formatters` transformations
	    var index = 0;
	    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
	      // if we encounter an escaped % then don't increase the array index
	      if (match === '%%') return match;
	      index++;
	      var formatter = exports.formatters[format];
	      if ('function' === typeof formatter) {
	        var val = args[index];
	        match = formatter.call(self, val);
	
	        // now we need to remove `args[index]` since it's inlined in the `format`
	        args.splice(index, 1);
	        index--;
	      }
	      return match;
	    });
	
	    // apply env-specific formatting (colors, etc.)
	    exports.formatArgs.call(self, args);
	
	    var logFn = debug.log || exports.log || console.log.bind(console);
	    logFn.apply(self, args);
	  }
	
	  debug.namespace = namespace;
	  debug.enabled = exports.enabled(namespace);
	  debug.useColors = exports.useColors();
	  debug.color = selectColor(namespace);
	  debug.destroy = destroy;
	
	  // env-specific initialization logic for debug instances
	  if ('function' === typeof exports.init) {
	    exports.init(debug);
	  }
	
	  exports.instances.push(debug);
	
	  return debug;
	}
	
	function destroy () {
	  var index = exports.instances.indexOf(this);
	  if (index !== -1) {
	    exports.instances.splice(index, 1);
	    return true;
	  } else {
	    return false;
	  }
	}
	
	/**
	 * Enables a debug mode by namespaces. This can include modes
	 * separated by a colon and wildcards.
	 *
	 * @param {String} namespaces
	 * @api public
	 */
	
	function enable(namespaces) {
	  exports.save(namespaces);
	
	  exports.names = [];
	  exports.skips = [];
	
	  var i;
	  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
	  var len = split.length;
	
	  for (i = 0; i < len; i++) {
	    if (!split[i]) continue; // ignore empty strings
	    namespaces = split[i].replace(/\*/g, '.*?');
	    if (namespaces[0] === '-') {
	      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
	    } else {
	      exports.names.push(new RegExp('^' + namespaces + '$'));
	    }
	  }
	
	  for (i = 0; i < exports.instances.length; i++) {
	    var instance = exports.instances[i];
	    instance.enabled = exports.enabled(instance.namespace);
	  }
	}
	
	/**
	 * Disable debug output.
	 *
	 * @api public
	 */
	
	function disable() {
	  exports.enable('');
	}
	
	/**
	 * Returns true if the given mode name is enabled, false otherwise.
	 *
	 * @param {String} name
	 * @return {Boolean}
	 * @api public
	 */
	
	function enabled(name) {
	  if (name[name.length - 1] === '*') {
	    return true;
	  }
	  var i, len;
	  for (i = 0, len = exports.skips.length; i < len; i++) {
	    if (exports.skips[i].test(name)) {
	      return false;
	    }
	  }
	  for (i = 0, len = exports.names.length; i < len; i++) {
	    if (exports.names[i].test(name)) {
	      return true;
	    }
	  }
	  return false;
	}
	
	/**
	 * Coerce `val`.
	 *
	 * @param {Mixed} val
	 * @return {Mixed}
	 * @api private
	 */
	
	function coerce(val) {
	  if (val instanceof Error) return val.stack || val.message;
	  return val;
	}


/***/ }),
/* 116 */
/***/ (function(module, exports) {

	/**
	 * Helpers.
	 */
	
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var y = d * 365.25;
	
	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} [options]
	 * @throws {Error} throw an error if val is not a non-empty string or a number
	 * @return {String|Number}
	 * @api public
	 */
	
	module.exports = function(val, options) {
	  options = options || {};
	  var type = typeof val;
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isNaN(val) === false) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error(
	    'val is not a non-empty string or a valid number. val=' +
	      JSON.stringify(val)
	  );
	};
	
	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */
	
	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
	    str
	  );
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}
	
	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */
	
	function fmtShort(ms) {
	  if (ms >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (ms >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (ms >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (ms >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}
	
	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */
	
	function fmtLong(ms) {
	  return plural(ms, d, 'day') ||
	    plural(ms, h, 'hour') ||
	    plural(ms, m, 'minute') ||
	    plural(ms, s, 'second') ||
	    ms + ' ms';
	}
	
	/**
	 * Pluralization helper.
	 */
	
	function plural(ms, n, name) {
	  if (ms < n) {
	    return;
	  }
	  if (ms < n * 1.5) {
	    return Math.floor(ms / n) + ' ' + name;
	  }
	  return Math.ceil(ms / n) + ' ' + name + 's';
	}


/***/ }),
/* 117 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * lodash (Custom Build) <https://lodash.com/>
	 * Build: `lodash modularize exports="npm" -o ./`
	 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
	 * Released under MIT license <https://lodash.com/license>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 */
	
	/** Used as the `TypeError` message for "Functions" methods. */
	var FUNC_ERROR_TEXT = 'Expected a function';
	
	/** Used to stand-in for `undefined` hash values. */
	var HASH_UNDEFINED = '__lodash_hash_undefined__';
	
	/** Used as references for various `Number` constants. */
	var INFINITY = 1 / 0,
	    MAX_SAFE_INTEGER = 9007199254740991;
	
	/** `Object#toString` result references. */
	var argsTag = '[object Arguments]',
	    funcTag = '[object Function]',
	    genTag = '[object GeneratorFunction]',
	    symbolTag = '[object Symbol]';
	
	/** Used to match property names within property paths. */
	var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
	    reIsPlainProp = /^\w*$/,
	    reLeadingDot = /^\./,
	    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
	
	/**
	 * Used to match `RegExp`
	 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	 */
	var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
	
	/** Used to match backslashes in property paths. */
	var reEscapeChar = /\\(\\)?/g;
	
	/** Used to detect host constructors (Safari). */
	var reIsHostCtor = /^\[object .+?Constructor\]$/;
	
	/** Used to detect unsigned integer values. */
	var reIsUint = /^(?:0|[1-9]\d*)$/;
	
	/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;
	
	/** Detect free variable `self`. */
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;
	
	/** Used as a reference to the global object. */
	var root = freeGlobal || freeSelf || Function('return this')();
	
	/**
	 * A faster alternative to `Function#apply`, this function invokes `func`
	 * with the `this` binding of `thisArg` and the arguments of `args`.
	 *
	 * @private
	 * @param {Function} func The function to invoke.
	 * @param {*} thisArg The `this` binding of `func`.
	 * @param {Array} args The arguments to invoke `func` with.
	 * @returns {*} Returns the result of `func`.
	 */
	function apply(func, thisArg, args) {
	  switch (args.length) {
	    case 0: return func.call(thisArg);
	    case 1: return func.call(thisArg, args[0]);
	    case 2: return func.call(thisArg, args[0], args[1]);
	    case 3: return func.call(thisArg, args[0], args[1], args[2]);
	  }
	  return func.apply(thisArg, args);
	}
	
	/**
	 * A specialized version of `_.map` for arrays without support for iteratee
	 * shorthands.
	 *
	 * @private
	 * @param {Array} [array] The array to iterate over.
	 * @param {Function} iteratee The function invoked per iteration.
	 * @returns {Array} Returns the new mapped array.
	 */
	function arrayMap(array, iteratee) {
	  var index = -1,
	      length = array ? array.length : 0,
	      result = Array(length);
	
	  while (++index < length) {
	    result[index] = iteratee(array[index], index, array);
	  }
	  return result;
	}
	
	/**
	 * Appends the elements of `values` to `array`.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {Array} values The values to append.
	 * @returns {Array} Returns `array`.
	 */
	function arrayPush(array, values) {
	  var index = -1,
	      length = values.length,
	      offset = array.length;
	
	  while (++index < length) {
	    array[offset + index] = values[index];
	  }
	  return array;
	}
	
	/**
	 * Gets the value at `key` of `object`.
	 *
	 * @private
	 * @param {Object} [object] The object to query.
	 * @param {string} key The key of the property to get.
	 * @returns {*} Returns the property value.
	 */
	function getValue(object, key) {
	  return object == null ? undefined : object[key];
	}
	
	/**
	 * Checks if `value` is a host object in IE < 9.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
	 */
	function isHostObject(value) {
	  // Many host objects are `Object` objects that can coerce to strings
	  // despite having improperly defined `toString` methods.
	  var result = false;
	  if (value != null && typeof value.toString != 'function') {
	    try {
	      result = !!(value + '');
	    } catch (e) {}
	  }
	  return result;
	}
	
	/** Used for built-in method references. */
	var arrayProto = Array.prototype,
	    funcProto = Function.prototype,
	    objectProto = Object.prototype;
	
	/** Used to detect overreaching core-js shims. */
	var coreJsData = root['__core-js_shared__'];
	
	/** Used to detect methods masquerading as native. */
	var maskSrcKey = (function() {
	  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
	  return uid ? ('Symbol(src)_1.' + uid) : '';
	}());
	
	/** Used to resolve the decompiled source of functions. */
	var funcToString = funcProto.toString;
	
	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;
	
	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var objectToString = objectProto.toString;
	
	/** Used to detect if a method is native. */
	var reIsNative = RegExp('^' +
	  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
	  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);
	
	/** Built-in value references. */
	var Symbol = root.Symbol,
	    propertyIsEnumerable = objectProto.propertyIsEnumerable,
	    splice = arrayProto.splice,
	    spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined;
	
	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max;
	
	/* Built-in method references that are verified to be native. */
	var Map = getNative(root, 'Map'),
	    nativeCreate = getNative(Object, 'create');
	
	/** Used to convert symbols to primitives and strings. */
	var symbolProto = Symbol ? Symbol.prototype : undefined,
	    symbolToString = symbolProto ? symbolProto.toString : undefined;
	
	/**
	 * Creates a hash object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function Hash(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	/**
	 * Removes all key-value entries from the hash.
	 *
	 * @private
	 * @name clear
	 * @memberOf Hash
	 */
	function hashClear() {
	  this.__data__ = nativeCreate ? nativeCreate(null) : {};
	}
	
	/**
	 * Removes `key` and its value from the hash.
	 *
	 * @private
	 * @name delete
	 * @memberOf Hash
	 * @param {Object} hash The hash to modify.
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function hashDelete(key) {
	  return this.has(key) && delete this.__data__[key];
	}
	
	/**
	 * Gets the hash value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf Hash
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function hashGet(key) {
	  var data = this.__data__;
	  if (nativeCreate) {
	    var result = data[key];
	    return result === HASH_UNDEFINED ? undefined : result;
	  }
	  return hasOwnProperty.call(data, key) ? data[key] : undefined;
	}
	
	/**
	 * Checks if a hash value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf Hash
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function hashHas(key) {
	  var data = this.__data__;
	  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
	}
	
	/**
	 * Sets the hash `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf Hash
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the hash instance.
	 */
	function hashSet(key, value) {
	  var data = this.__data__;
	  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
	  return this;
	}
	
	// Add methods to `Hash`.
	Hash.prototype.clear = hashClear;
	Hash.prototype['delete'] = hashDelete;
	Hash.prototype.get = hashGet;
	Hash.prototype.has = hashHas;
	Hash.prototype.set = hashSet;
	
	/**
	 * Creates an list cache object.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function ListCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	/**
	 * Removes all key-value entries from the list cache.
	 *
	 * @private
	 * @name clear
	 * @memberOf ListCache
	 */
	function listCacheClear() {
	  this.__data__ = [];
	}
	
	/**
	 * Removes `key` and its value from the list cache.
	 *
	 * @private
	 * @name delete
	 * @memberOf ListCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function listCacheDelete(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  if (index < 0) {
	    return false;
	  }
	  var lastIndex = data.length - 1;
	  if (index == lastIndex) {
	    data.pop();
	  } else {
	    splice.call(data, index, 1);
	  }
	  return true;
	}
	
	/**
	 * Gets the list cache value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf ListCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function listCacheGet(key) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  return index < 0 ? undefined : data[index][1];
	}
	
	/**
	 * Checks if a list cache value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf ListCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function listCacheHas(key) {
	  return assocIndexOf(this.__data__, key) > -1;
	}
	
	/**
	 * Sets the list cache `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf ListCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the list cache instance.
	 */
	function listCacheSet(key, value) {
	  var data = this.__data__,
	      index = assocIndexOf(data, key);
	
	  if (index < 0) {
	    data.push([key, value]);
	  } else {
	    data[index][1] = value;
	  }
	  return this;
	}
	
	// Add methods to `ListCache`.
	ListCache.prototype.clear = listCacheClear;
	ListCache.prototype['delete'] = listCacheDelete;
	ListCache.prototype.get = listCacheGet;
	ListCache.prototype.has = listCacheHas;
	ListCache.prototype.set = listCacheSet;
	
	/**
	 * Creates a map cache object to store key-value pairs.
	 *
	 * @private
	 * @constructor
	 * @param {Array} [entries] The key-value pairs to cache.
	 */
	function MapCache(entries) {
	  var index = -1,
	      length = entries ? entries.length : 0;
	
	  this.clear();
	  while (++index < length) {
	    var entry = entries[index];
	    this.set(entry[0], entry[1]);
	  }
	}
	
	/**
	 * Removes all key-value entries from the map.
	 *
	 * @private
	 * @name clear
	 * @memberOf MapCache
	 */
	function mapCacheClear() {
	  this.__data__ = {
	    'hash': new Hash,
	    'map': new (Map || ListCache),
	    'string': new Hash
	  };
	}
	
	/**
	 * Removes `key` and its value from the map.
	 *
	 * @private
	 * @name delete
	 * @memberOf MapCache
	 * @param {string} key The key of the value to remove.
	 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	 */
	function mapCacheDelete(key) {
	  return getMapData(this, key)['delete'](key);
	}
	
	/**
	 * Gets the map value for `key`.
	 *
	 * @private
	 * @name get
	 * @memberOf MapCache
	 * @param {string} key The key of the value to get.
	 * @returns {*} Returns the entry value.
	 */
	function mapCacheGet(key) {
	  return getMapData(this, key).get(key);
	}
	
	/**
	 * Checks if a map value for `key` exists.
	 *
	 * @private
	 * @name has
	 * @memberOf MapCache
	 * @param {string} key The key of the entry to check.
	 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	 */
	function mapCacheHas(key) {
	  return getMapData(this, key).has(key);
	}
	
	/**
	 * Sets the map `key` to `value`.
	 *
	 * @private
	 * @name set
	 * @memberOf MapCache
	 * @param {string} key The key of the value to set.
	 * @param {*} value The value to set.
	 * @returns {Object} Returns the map cache instance.
	 */
	function mapCacheSet(key, value) {
	  getMapData(this, key).set(key, value);
	  return this;
	}
	
	// Add methods to `MapCache`.
	MapCache.prototype.clear = mapCacheClear;
	MapCache.prototype['delete'] = mapCacheDelete;
	MapCache.prototype.get = mapCacheGet;
	MapCache.prototype.has = mapCacheHas;
	MapCache.prototype.set = mapCacheSet;
	
	/**
	 * Gets the index at which the `key` is found in `array` of key-value pairs.
	 *
	 * @private
	 * @param {Array} array The array to inspect.
	 * @param {*} key The key to search for.
	 * @returns {number} Returns the index of the matched value, else `-1`.
	 */
	function assocIndexOf(array, key) {
	  var length = array.length;
	  while (length--) {
	    if (eq(array[length][0], key)) {
	      return length;
	    }
	  }
	  return -1;
	}
	
	/**
	 * The base implementation of `_.at` without support for individual paths.
	 *
	 * @private
	 * @param {Object} object The object to iterate over.
	 * @param {string[]} paths The property paths of elements to pick.
	 * @returns {Array} Returns the picked elements.
	 */
	function baseAt(object, paths) {
	  var index = -1,
	      isNil = object == null,
	      length = paths.length,
	      result = Array(length);
	
	  while (++index < length) {
	    result[index] = isNil ? undefined : get(object, paths[index]);
	  }
	  return result;
	}
	
	/**
	 * The base implementation of `_.flatten` with support for restricting flattening.
	 *
	 * @private
	 * @param {Array} array The array to flatten.
	 * @param {number} depth The maximum recursion depth.
	 * @param {boolean} [predicate=isFlattenable] The function invoked per iteration.
	 * @param {boolean} [isStrict] Restrict to values that pass `predicate` checks.
	 * @param {Array} [result=[]] The initial result value.
	 * @returns {Array} Returns the new flattened array.
	 */
	function baseFlatten(array, depth, predicate, isStrict, result) {
	  var index = -1,
	      length = array.length;
	
	  predicate || (predicate = isFlattenable);
	  result || (result = []);
	
	  while (++index < length) {
	    var value = array[index];
	    if (depth > 0 && predicate(value)) {
	      if (depth > 1) {
	        // Recursively flatten arrays (susceptible to call stack limits).
	        baseFlatten(value, depth - 1, predicate, isStrict, result);
	      } else {
	        arrayPush(result, value);
	      }
	    } else if (!isStrict) {
	      result[result.length] = value;
	    }
	  }
	  return result;
	}
	
	/**
	 * The base implementation of `_.get` without support for default values.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Array|string} path The path of the property to get.
	 * @returns {*} Returns the resolved value.
	 */
	function baseGet(object, path) {
	  path = isKey(path, object) ? [path] : castPath(path);
	
	  var index = 0,
	      length = path.length;
	
	  while (object != null && index < length) {
	    object = object[toKey(path[index++])];
	  }
	  return (index && index == length) ? object : undefined;
	}
	
	/**
	 * The base implementation of `_.isNative` without bad shim checks.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a native function,
	 *  else `false`.
	 */
	function baseIsNative(value) {
	  if (!isObject(value) || isMasked(value)) {
	    return false;
	  }
	  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
	  return pattern.test(toSource(value));
	}
	
	/**
	 * The base implementation of `_.pullAt` without support for individual
	 * indexes or capturing the removed elements.
	 *
	 * @private
	 * @param {Array} array The array to modify.
	 * @param {number[]} indexes The indexes of elements to remove.
	 * @returns {Array} Returns `array`.
	 */
	function basePullAt(array, indexes) {
	  var length = array ? indexes.length : 0,
	      lastIndex = length - 1;
	
	  while (length--) {
	    var index = indexes[length];
	    if (length == lastIndex || index !== previous) {
	      var previous = index;
	      if (isIndex(index)) {
	        splice.call(array, index, 1);
	      }
	      else if (!isKey(index, array)) {
	        var path = castPath(index),
	            object = parent(array, path);
	
	        if (object != null) {
	          delete object[toKey(last(path))];
	        }
	      }
	      else {
	        delete array[toKey(index)];
	      }
	    }
	  }
	  return array;
	}
	
	/**
	 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
	 *
	 * @private
	 * @param {Function} func The function to apply a rest parameter to.
	 * @param {number} [start=func.length-1] The start position of the rest parameter.
	 * @returns {Function} Returns the new function.
	 */
	function baseRest(func, start) {
	  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
	  return function() {
	    var args = arguments,
	        index = -1,
	        length = nativeMax(args.length - start, 0),
	        array = Array(length);
	
	    while (++index < length) {
	      array[index] = args[start + index];
	    }
	    index = -1;
	    var otherArgs = Array(start + 1);
	    while (++index < start) {
	      otherArgs[index] = args[index];
	    }
	    otherArgs[start] = array;
	    return apply(func, this, otherArgs);
	  };
	}
	
	/**
	 * The base implementation of `_.slice` without an iteratee call guard.
	 *
	 * @private
	 * @param {Array} array The array to slice.
	 * @param {number} [start=0] The start position.
	 * @param {number} [end=array.length] The end position.
	 * @returns {Array} Returns the slice of `array`.
	 */
	function baseSlice(array, start, end) {
	  var index = -1,
	      length = array.length;
	
	  if (start < 0) {
	    start = -start > length ? 0 : (length + start);
	  }
	  end = end > length ? length : end;
	  if (end < 0) {
	    end += length;
	  }
	  length = start > end ? 0 : ((end - start) >>> 0);
	  start >>>= 0;
	
	  var result = Array(length);
	  while (++index < length) {
	    result[index] = array[index + start];
	  }
	  return result;
	}
	
	/**
	 * The base implementation of `_.toString` which doesn't convert nullish
	 * values to empty strings.
	 *
	 * @private
	 * @param {*} value The value to process.
	 * @returns {string} Returns the string.
	 */
	function baseToString(value) {
	  // Exit early for strings to avoid a performance hit in some environments.
	  if (typeof value == 'string') {
	    return value;
	  }
	  if (isSymbol(value)) {
	    return symbolToString ? symbolToString.call(value) : '';
	  }
	  var result = (value + '');
	  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
	}
	
	/**
	 * Casts `value` to a path array if it's not one.
	 *
	 * @private
	 * @param {*} value The value to inspect.
	 * @returns {Array} Returns the cast property path array.
	 */
	function castPath(value) {
	  return isArray(value) ? value : stringToPath(value);
	}
	
	/**
	 * Compares values to sort them in ascending order.
	 *
	 * @private
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {number} Returns the sort order indicator for `value`.
	 */
	function compareAscending(value, other) {
	  if (value !== other) {
	    var valIsDefined = value !== undefined,
	        valIsNull = value === null,
	        valIsReflexive = value === value,
	        valIsSymbol = isSymbol(value);
	
	    var othIsDefined = other !== undefined,
	        othIsNull = other === null,
	        othIsReflexive = other === other,
	        othIsSymbol = isSymbol(other);
	
	    if ((!othIsNull && !othIsSymbol && !valIsSymbol && value > other) ||
	        (valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol) ||
	        (valIsNull && othIsDefined && othIsReflexive) ||
	        (!valIsDefined && othIsReflexive) ||
	        !valIsReflexive) {
	      return 1;
	    }
	    if ((!valIsNull && !valIsSymbol && !othIsSymbol && value < other) ||
	        (othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol) ||
	        (othIsNull && valIsDefined && valIsReflexive) ||
	        (!othIsDefined && valIsReflexive) ||
	        !othIsReflexive) {
	      return -1;
	    }
	  }
	  return 0;
	}
	
	/**
	 * Gets the data for `map`.
	 *
	 * @private
	 * @param {Object} map The map to query.
	 * @param {string} key The reference key.
	 * @returns {*} Returns the map data.
	 */
	function getMapData(map, key) {
	  var data = map.__data__;
	  return isKeyable(key)
	    ? data[typeof key == 'string' ? 'string' : 'hash']
	    : data.map;
	}
	
	/**
	 * Gets the native function at `key` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {string} key The key of the method to get.
	 * @returns {*} Returns the function if it's native, else `undefined`.
	 */
	function getNative(object, key) {
	  var value = getValue(object, key);
	  return baseIsNative(value) ? value : undefined;
	}
	
	/**
	 * Checks if `value` is a flattenable `arguments` object or array.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is flattenable, else `false`.
	 */
	function isFlattenable(value) {
	  return isArray(value) || isArguments(value) ||
	    !!(spreadableSymbol && value && value[spreadableSymbol]);
	}
	
	/**
	 * Checks if `value` is a valid array-like index.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	 */
	function isIndex(value, length) {
	  length = length == null ? MAX_SAFE_INTEGER : length;
	  return !!length &&
	    (typeof value == 'number' || reIsUint.test(value)) &&
	    (value > -1 && value % 1 == 0 && value < length);
	}
	
	/**
	 * Checks if `value` is a property name and not a property path.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @param {Object} [object] The object to query keys on.
	 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
	 */
	function isKey(value, object) {
	  if (isArray(value)) {
	    return false;
	  }
	  var type = typeof value;
	  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
	      value == null || isSymbol(value)) {
	    return true;
	  }
	  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
	    (object != null && value in Object(object));
	}
	
	/**
	 * Checks if `value` is suitable for use as unique object key.
	 *
	 * @private
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	 */
	function isKeyable(value) {
	  var type = typeof value;
	  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
	    ? (value !== '__proto__')
	    : (value === null);
	}
	
	/**
	 * Checks if `func` has its source masked.
	 *
	 * @private
	 * @param {Function} func The function to check.
	 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
	 */
	function isMasked(func) {
	  return !!maskSrcKey && (maskSrcKey in func);
	}
	
	/**
	 * Gets the parent value at `path` of `object`.
	 *
	 * @private
	 * @param {Object} object The object to query.
	 * @param {Array} path The path to get the parent value of.
	 * @returns {*} Returns the parent value.
	 */
	function parent(object, path) {
	  return path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
	}
	
	/**
	 * Converts `string` to a property path array.
	 *
	 * @private
	 * @param {string} string The string to convert.
	 * @returns {Array} Returns the property path array.
	 */
	var stringToPath = memoize(function(string) {
	  string = toString(string);
	
	  var result = [];
	  if (reLeadingDot.test(string)) {
	    result.push('');
	  }
	  string.replace(rePropName, function(match, number, quote, string) {
	    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
	  });
	  return result;
	});
	
	/**
	 * Converts `value` to a string key if it's not a string or symbol.
	 *
	 * @private
	 * @param {*} value The value to inspect.
	 * @returns {string|symbol} Returns the key.
	 */
	function toKey(value) {
	  if (typeof value == 'string' || isSymbol(value)) {
	    return value;
	  }
	  var result = (value + '');
	  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
	}
	
	/**
	 * Converts `func` to its source code.
	 *
	 * @private
	 * @param {Function} func The function to process.
	 * @returns {string} Returns the source code.
	 */
	function toSource(func) {
	  if (func != null) {
	    try {
	      return funcToString.call(func);
	    } catch (e) {}
	    try {
	      return (func + '');
	    } catch (e) {}
	  }
	  return '';
	}
	
	/**
	 * Gets the last element of `array`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Array
	 * @param {Array} array The array to query.
	 * @returns {*} Returns the last element of `array`.
	 * @example
	 *
	 * _.last([1, 2, 3]);
	 * // => 3
	 */
	function last(array) {
	  var length = array ? array.length : 0;
	  return length ? array[length - 1] : undefined;
	}
	
	/**
	 * Removes elements from `array` corresponding to `indexes` and returns an
	 * array of removed elements.
	 *
	 * **Note:** Unlike `_.at`, this method mutates `array`.
	 *
	 * @static
	 * @memberOf _
	 * @since 3.0.0
	 * @category Array
	 * @param {Array} array The array to modify.
	 * @param {...(number|number[])} [indexes] The indexes of elements to remove.
	 * @returns {Array} Returns the new array of removed elements.
	 * @example
	 *
	 * var array = ['a', 'b', 'c', 'd'];
	 * var pulled = _.pullAt(array, [1, 3]);
	 *
	 * console.log(array);
	 * // => ['a', 'c']
	 *
	 * console.log(pulled);
	 * // => ['b', 'd']
	 */
	var pullAt = baseRest(function(array, indexes) {
	  indexes = baseFlatten(indexes, 1);
	
	  var length = array ? array.length : 0,
	      result = baseAt(array, indexes);
	
	  basePullAt(array, arrayMap(indexes, function(index) {
	    return isIndex(index, length) ? +index : index;
	  }).sort(compareAscending));
	
	  return result;
	});
	
	/**
	 * Creates a function that memoizes the result of `func`. If `resolver` is
	 * provided, it determines the cache key for storing the result based on the
	 * arguments provided to the memoized function. By default, the first argument
	 * provided to the memoized function is used as the map cache key. The `func`
	 * is invoked with the `this` binding of the memoized function.
	 *
	 * **Note:** The cache is exposed as the `cache` property on the memoized
	 * function. Its creation may be customized by replacing the `_.memoize.Cache`
	 * constructor with one whose instances implement the
	 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
	 * method interface of `delete`, `get`, `has`, and `set`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Function
	 * @param {Function} func The function to have its output memoized.
	 * @param {Function} [resolver] The function to resolve the cache key.
	 * @returns {Function} Returns the new memoized function.
	 * @example
	 *
	 * var object = { 'a': 1, 'b': 2 };
	 * var other = { 'c': 3, 'd': 4 };
	 *
	 * var values = _.memoize(_.values);
	 * values(object);
	 * // => [1, 2]
	 *
	 * values(other);
	 * // => [3, 4]
	 *
	 * object.a = 2;
	 * values(object);
	 * // => [1, 2]
	 *
	 * // Modify the result cache.
	 * values.cache.set(object, ['a', 'b']);
	 * values(object);
	 * // => ['a', 'b']
	 *
	 * // Replace `_.memoize.Cache`.
	 * _.memoize.Cache = WeakMap;
	 */
	function memoize(func, resolver) {
	  if (typeof func != 'function' || (resolver && typeof resolver != 'function')) {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  var memoized = function() {
	    var args = arguments,
	        key = resolver ? resolver.apply(this, args) : args[0],
	        cache = memoized.cache;
	
	    if (cache.has(key)) {
	      return cache.get(key);
	    }
	    var result = func.apply(this, args);
	    memoized.cache = cache.set(key, result);
	    return result;
	  };
	  memoized.cache = new (memoize.Cache || MapCache);
	  return memoized;
	}
	
	// Assign cache to `_.memoize`.
	memoize.Cache = MapCache;
	
	/**
	 * Performs a
	 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	 * comparison between two values to determine if they are equivalent.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to compare.
	 * @param {*} other The other value to compare.
	 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	 * @example
	 *
	 * var object = { 'a': 1 };
	 * var other = { 'a': 1 };
	 *
	 * _.eq(object, object);
	 * // => true
	 *
	 * _.eq(object, other);
	 * // => false
	 *
	 * _.eq('a', 'a');
	 * // => true
	 *
	 * _.eq('a', Object('a'));
	 * // => false
	 *
	 * _.eq(NaN, NaN);
	 * // => true
	 */
	function eq(value, other) {
	  return value === other || (value !== value && other !== other);
	}
	
	/**
	 * Checks if `value` is likely an `arguments` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArguments(function() { return arguments; }());
	 * // => true
	 *
	 * _.isArguments([1, 2, 3]);
	 * // => false
	 */
	function isArguments(value) {
	  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
	  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
	    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
	}
	
	/**
	 * Checks if `value` is classified as an `Array` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
	 * @example
	 *
	 * _.isArray([1, 2, 3]);
	 * // => true
	 *
	 * _.isArray(document.body.children);
	 * // => false
	 *
	 * _.isArray('abc');
	 * // => false
	 *
	 * _.isArray(_.noop);
	 * // => false
	 */
	var isArray = Array.isArray;
	
	/**
	 * Checks if `value` is array-like. A value is considered array-like if it's
	 * not a function and has a `value.length` that's an integer greater than or
	 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	 * @example
	 *
	 * _.isArrayLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLike(document.body.children);
	 * // => true
	 *
	 * _.isArrayLike('abc');
	 * // => true
	 *
	 * _.isArrayLike(_.noop);
	 * // => false
	 */
	function isArrayLike(value) {
	  return value != null && isLength(value.length) && !isFunction(value);
	}
	
	/**
	 * This method is like `_.isArrayLike` except that it also checks if `value`
	 * is an object.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an array-like object,
	 *  else `false`.
	 * @example
	 *
	 * _.isArrayLikeObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isArrayLikeObject(document.body.children);
	 * // => true
	 *
	 * _.isArrayLikeObject('abc');
	 * // => false
	 *
	 * _.isArrayLikeObject(_.noop);
	 * // => false
	 */
	function isArrayLikeObject(value) {
	  return isObjectLike(value) && isArrayLike(value);
	}
	
	/**
	 * Checks if `value` is classified as a `Function` object.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
	 * @example
	 *
	 * _.isFunction(_);
	 * // => true
	 *
	 * _.isFunction(/abc/);
	 * // => false
	 */
	function isFunction(value) {
	  // The use of `Object#toString` avoids issues with the `typeof` operator
	  // in Safari 8-9 which returns 'object' for typed array and other constructors.
	  var tag = isObject(value) ? objectToString.call(value) : '';
	  return tag == funcTag || tag == genTag;
	}
	
	/**
	 * Checks if `value` is a valid array-like length.
	 *
	 * **Note:** This method is loosely based on
	 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	 * @example
	 *
	 * _.isLength(3);
	 * // => true
	 *
	 * _.isLength(Number.MIN_VALUE);
	 * // => false
	 *
	 * _.isLength(Infinity);
	 * // => false
	 *
	 * _.isLength('3');
	 * // => false
	 */
	function isLength(value) {
	  return typeof value == 'number' &&
	    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
	}
	
	/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  var type = typeof value;
	  return !!value && (type == 'object' || type == 'function');
	}
	
	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return !!value && typeof value == 'object';
	}
	
	/**
	 * Checks if `value` is classified as a `Symbol` primitive or object.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	 * @example
	 *
	 * _.isSymbol(Symbol.iterator);
	 * // => true
	 *
	 * _.isSymbol('abc');
	 * // => false
	 */
	function isSymbol(value) {
	  return typeof value == 'symbol' ||
	    (isObjectLike(value) && objectToString.call(value) == symbolTag);
	}
	
	/**
	 * Converts `value` to a string. An empty string is returned for `null`
	 * and `undefined` values. The sign of `-0` is preserved.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to process.
	 * @returns {string} Returns the string.
	 * @example
	 *
	 * _.toString(null);
	 * // => ''
	 *
	 * _.toString(-0);
	 * // => '-0'
	 *
	 * _.toString([1, 2, 3]);
	 * // => '1,2,3'
	 */
	function toString(value) {
	  return value == null ? '' : baseToString(value);
	}
	
	/**
	 * Gets the value at `path` of `object`. If the resolved value is
	 * `undefined`, the `defaultValue` is returned in its place.
	 *
	 * @static
	 * @memberOf _
	 * @since 3.7.0
	 * @category Object
	 * @param {Object} object The object to query.
	 * @param {Array|string} path The path of the property to get.
	 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
	 * @returns {*} Returns the resolved value.
	 * @example
	 *
	 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
	 *
	 * _.get(object, 'a[0].b.c');
	 * // => 3
	 *
	 * _.get(object, ['a', '0', 'b', 'c']);
	 * // => 3
	 *
	 * _.get(object, 'a.b.c', 'default');
	 * // => 'default'
	 */
	function get(object, path, defaultValue) {
	  var result = object == null ? undefined : baseGet(object, path);
	  return result === undefined ? defaultValue : result;
	}
	
	module.exports = pullAt;
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 118 */
/***/ (function(module, exports) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.
	
	function EventEmitter() {
	  this._events = this._events || {};
	  this._maxListeners = this._maxListeners || undefined;
	}
	module.exports = EventEmitter;
	
	// Backwards-compat with node 0.10.x
	EventEmitter.EventEmitter = EventEmitter;
	
	EventEmitter.prototype._events = undefined;
	EventEmitter.prototype._maxListeners = undefined;
	
	// By default EventEmitters will print a warning if more than 10 listeners are
	// added to it. This is a useful default which helps finding memory leaks.
	EventEmitter.defaultMaxListeners = 10;
	
	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	EventEmitter.prototype.setMaxListeners = function(n) {
	  if (!isNumber(n) || n < 0 || isNaN(n))
	    throw TypeError('n must be a positive number');
	  this._maxListeners = n;
	  return this;
	};
	
	EventEmitter.prototype.emit = function(type) {
	  var er, handler, len, args, i, listeners;
	
	  if (!this._events)
	    this._events = {};
	
	  // If there is no 'error' event listener then throw.
	  if (type === 'error') {
	    if (!this._events.error ||
	        (isObject(this._events.error) && !this._events.error.length)) {
	      er = arguments[1];
	      if (er instanceof Error) {
	        throw er; // Unhandled 'error' event
	      } else {
	        // At least give some kind of context to the user
	        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
	        err.context = er;
	        throw err;
	      }
	    }
	  }
	
	  handler = this._events[type];
	
	  if (isUndefined(handler))
	    return false;
	
	  if (isFunction(handler)) {
	    switch (arguments.length) {
	      // fast cases
	      case 1:
	        handler.call(this);
	        break;
	      case 2:
	        handler.call(this, arguments[1]);
	        break;
	      case 3:
	        handler.call(this, arguments[1], arguments[2]);
	        break;
	      // slower
	      default:
	        args = Array.prototype.slice.call(arguments, 1);
	        handler.apply(this, args);
	    }
	  } else if (isObject(handler)) {
	    args = Array.prototype.slice.call(arguments, 1);
	    listeners = handler.slice();
	    len = listeners.length;
	    for (i = 0; i < len; i++)
	      listeners[i].apply(this, args);
	  }
	
	  return true;
	};
	
	EventEmitter.prototype.addListener = function(type, listener) {
	  var m;
	
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');
	
	  if (!this._events)
	    this._events = {};
	
	  // To avoid recursion in the case that type === "newListener"! Before
	  // adding it to the listeners, first emit "newListener".
	  if (this._events.newListener)
	    this.emit('newListener', type,
	              isFunction(listener.listener) ?
	              listener.listener : listener);
	
	  if (!this._events[type])
	    // Optimize the case of one listener. Don't need the extra array object.
	    this._events[type] = listener;
	  else if (isObject(this._events[type]))
	    // If we've already got an array, just append.
	    this._events[type].push(listener);
	  else
	    // Adding the second element, need to change to array.
	    this._events[type] = [this._events[type], listener];
	
	  // Check for listener leak
	  if (isObject(this._events[type]) && !this._events[type].warned) {
	    if (!isUndefined(this._maxListeners)) {
	      m = this._maxListeners;
	    } else {
	      m = EventEmitter.defaultMaxListeners;
	    }
	
	    if (m && m > 0 && this._events[type].length > m) {
	      this._events[type].warned = true;
	      console.error('(node) warning: possible EventEmitter memory ' +
	                    'leak detected. %d listeners added. ' +
	                    'Use emitter.setMaxListeners() to increase limit.',
	                    this._events[type].length);
	      if (typeof console.trace === 'function') {
	        // not supported in IE 10
	        console.trace();
	      }
	    }
	  }
	
	  return this;
	};
	
	EventEmitter.prototype.on = EventEmitter.prototype.addListener;
	
	EventEmitter.prototype.once = function(type, listener) {
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');
	
	  var fired = false;
	
	  function g() {
	    this.removeListener(type, g);
	
	    if (!fired) {
	      fired = true;
	      listener.apply(this, arguments);
	    }
	  }
	
	  g.listener = listener;
	  this.on(type, g);
	
	  return this;
	};
	
	// emits a 'removeListener' event iff the listener was removed
	EventEmitter.prototype.removeListener = function(type, listener) {
	  var list, position, length, i;
	
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');
	
	  if (!this._events || !this._events[type])
	    return this;
	
	  list = this._events[type];
	  length = list.length;
	  position = -1;
	
	  if (list === listener ||
	      (isFunction(list.listener) && list.listener === listener)) {
	    delete this._events[type];
	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);
	
	  } else if (isObject(list)) {
	    for (i = length; i-- > 0;) {
	      if (list[i] === listener ||
	          (list[i].listener && list[i].listener === listener)) {
	        position = i;
	        break;
	      }
	    }
	
	    if (position < 0)
	      return this;
	
	    if (list.length === 1) {
	      list.length = 0;
	      delete this._events[type];
	    } else {
	      list.splice(position, 1);
	    }
	
	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);
	  }
	
	  return this;
	};
	
	EventEmitter.prototype.removeAllListeners = function(type) {
	  var key, listeners;
	
	  if (!this._events)
	    return this;
	
	  // not listening for removeListener, no need to emit
	  if (!this._events.removeListener) {
	    if (arguments.length === 0)
	      this._events = {};
	    else if (this._events[type])
	      delete this._events[type];
	    return this;
	  }
	
	  // emit removeListener for all listeners on all events
	  if (arguments.length === 0) {
	    for (key in this._events) {
	      if (key === 'removeListener') continue;
	      this.removeAllListeners(key);
	    }
	    this.removeAllListeners('removeListener');
	    this._events = {};
	    return this;
	  }
	
	  listeners = this._events[type];
	
	  if (isFunction(listeners)) {
	    this.removeListener(type, listeners);
	  } else if (listeners) {
	    // LIFO order
	    while (listeners.length)
	      this.removeListener(type, listeners[listeners.length - 1]);
	  }
	  delete this._events[type];
	
	  return this;
	};
	
	EventEmitter.prototype.listeners = function(type) {
	  var ret;
	  if (!this._events || !this._events[type])
	    ret = [];
	  else if (isFunction(this._events[type]))
	    ret = [this._events[type]];
	  else
	    ret = this._events[type].slice();
	  return ret;
	};
	
	EventEmitter.prototype.listenerCount = function(type) {
	  if (this._events) {
	    var evlistener = this._events[type];
	
	    if (isFunction(evlistener))
	      return 1;
	    else if (evlistener)
	      return evlistener.length;
	  }
	  return 0;
	};
	
	EventEmitter.listenerCount = function(emitter, type) {
	  return emitter.listenerCount(type);
	};
	
	function isFunction(arg) {
	  return typeof arg === 'function';
	}
	
	function isNumber(arg) {
	  return typeof arg === 'number';
	}
	
	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}
	
	function isUndefined(arg) {
	  return arg === void 0;
	}


/***/ }),
/* 119 */
/***/ (function(module, exports, __webpack_require__) {

	var apply = Function.prototype.apply;
	
	// DOM APIs, for completeness
	
	exports.setTimeout = function() {
	  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
	};
	exports.setInterval = function() {
	  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
	};
	exports.clearTimeout =
	exports.clearInterval = function(timeout) {
	  if (timeout) {
	    timeout.close();
	  }
	};
	
	function Timeout(id, clearFn) {
	  this._id = id;
	  this._clearFn = clearFn;
	}
	Timeout.prototype.unref = Timeout.prototype.ref = function() {};
	Timeout.prototype.close = function() {
	  this._clearFn.call(window, this._id);
	};
	
	// Does not start the time, just sets up the members needed.
	exports.enroll = function(item, msecs) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = msecs;
	};
	
	exports.unenroll = function(item) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = -1;
	};
	
	exports._unrefActive = exports.active = function(item) {
	  clearTimeout(item._idleTimeoutId);
	
	  var msecs = item._idleTimeout;
	  if (msecs >= 0) {
	    item._idleTimeoutId = setTimeout(function onTimeout() {
	      if (item._onTimeout)
	        item._onTimeout();
	    }, msecs);
	  }
	};
	
	// setimmediate attaches itself to the global object
	__webpack_require__(120);
	exports.setImmediate = setImmediate;
	exports.clearImmediate = clearImmediate;


/***/ }),
/* 120 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, process) {(function (global, undefined) {
	    "use strict";
	
	    if (global.setImmediate) {
	        return;
	    }
	
	    var nextHandle = 1; // Spec says greater than zero
	    var tasksByHandle = {};
	    var currentlyRunningATask = false;
	    var doc = global.document;
	    var registerImmediate;
	
	    function setImmediate(callback) {
	      // Callback can either be a function or a string
	      if (typeof callback !== "function") {
	        callback = new Function("" + callback);
	      }
	      // Copy function arguments
	      var args = new Array(arguments.length - 1);
	      for (var i = 0; i < args.length; i++) {
	          args[i] = arguments[i + 1];
	      }
	      // Store and register the task
	      var task = { callback: callback, args: args };
	      tasksByHandle[nextHandle] = task;
	      registerImmediate(nextHandle);
	      return nextHandle++;
	    }
	
	    function clearImmediate(handle) {
	        delete tasksByHandle[handle];
	    }
	
	    function run(task) {
	        var callback = task.callback;
	        var args = task.args;
	        switch (args.length) {
	        case 0:
	            callback();
	            break;
	        case 1:
	            callback(args[0]);
	            break;
	        case 2:
	            callback(args[0], args[1]);
	            break;
	        case 3:
	            callback(args[0], args[1], args[2]);
	            break;
	        default:
	            callback.apply(undefined, args);
	            break;
	        }
	    }
	
	    function runIfPresent(handle) {
	        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
	        // So if we're currently running a task, we'll need to delay this invocation.
	        if (currentlyRunningATask) {
	            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
	            // "too much recursion" error.
	            setTimeout(runIfPresent, 0, handle);
	        } else {
	            var task = tasksByHandle[handle];
	            if (task) {
	                currentlyRunningATask = true;
	                try {
	                    run(task);
	                } finally {
	                    clearImmediate(handle);
	                    currentlyRunningATask = false;
	                }
	            }
	        }
	    }
	
	    function installNextTickImplementation() {
	        registerImmediate = function(handle) {
	            process.nextTick(function () { runIfPresent(handle); });
	        };
	    }
	
	    function canUsePostMessage() {
	        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
	        // where `global.postMessage` means something completely different and can't be used for this purpose.
	        if (global.postMessage && !global.importScripts) {
	            var postMessageIsAsynchronous = true;
	            var oldOnMessage = global.onmessage;
	            global.onmessage = function() {
	                postMessageIsAsynchronous = false;
	            };
	            global.postMessage("", "*");
	            global.onmessage = oldOnMessage;
	            return postMessageIsAsynchronous;
	        }
	    }
	
	    function installPostMessageImplementation() {
	        // Installs an event handler on `global` for the `message` event: see
	        // * https://developer.mozilla.org/en/DOM/window.postMessage
	        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages
	
	        var messagePrefix = "setImmediate$" + Math.random() + "$";
	        var onGlobalMessage = function(event) {
	            if (event.source === global &&
	                typeof event.data === "string" &&
	                event.data.indexOf(messagePrefix) === 0) {
	                runIfPresent(+event.data.slice(messagePrefix.length));
	            }
	        };
	
	        if (global.addEventListener) {
	            global.addEventListener("message", onGlobalMessage, false);
	        } else {
	            global.attachEvent("onmessage", onGlobalMessage);
	        }
	
	        registerImmediate = function(handle) {
	            global.postMessage(messagePrefix + handle, "*");
	        };
	    }
	
	    function installMessageChannelImplementation() {
	        var channel = new MessageChannel();
	        channel.port1.onmessage = function(event) {
	            var handle = event.data;
	            runIfPresent(handle);
	        };
	
	        registerImmediate = function(handle) {
	            channel.port2.postMessage(handle);
	        };
	    }
	
	    function installReadyStateChangeImplementation() {
	        var html = doc.documentElement;
	        registerImmediate = function(handle) {
	            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
	            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
	            var script = doc.createElement("script");
	            script.onreadystatechange = function () {
	                runIfPresent(handle);
	                script.onreadystatechange = null;
	                html.removeChild(script);
	                script = null;
	            };
	            html.appendChild(script);
	        };
	    }
	
	    function installSetTimeoutImplementation() {
	        registerImmediate = function(handle) {
	            setTimeout(runIfPresent, 0, handle);
	        };
	    }
	
	    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
	    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
	    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;
	
	    // Don't get fooled by e.g. browserify environments.
	    if ({}.toString.call(global.process) === "[object process]") {
	        // For Node.js before 0.9
	        installNextTickImplementation();
	
	    } else if (canUsePostMessage()) {
	        // For non-IE10 modern browsers
	        installPostMessageImplementation();
	
	    } else if (global.MessageChannel) {
	        // For web workers, where supported
	        installMessageChannelImplementation();
	
	    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
	        // For IE 6–8
	        installReadyStateChangeImplementation();
	
	    } else {
	        // For older browsers
	        installSetTimeoutImplementation();
	    }
	
	    attachTo.setImmediate = setImmediate;
	    attachTo.clearImmediate = clearImmediate;
	}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(114)))

/***/ }),
/* 121 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var sources  = __webpack_require__(122)
	var sinks    = __webpack_require__(131)
	var throughs = __webpack_require__(140)
	
	exports = module.exports = __webpack_require__(151)
	
	exports.pull = exports
	
	for(var k in sources)
	  exports[k] = sources[k]
	
	for(var k in throughs)
	  exports[k] = throughs[k]
	
	for(var k in sinks)
	  exports[k] = sinks[k]
	


/***/ }),
/* 122 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	module.exports = {
	  keys: __webpack_require__(123),
	  once: __webpack_require__(126),
	  values: __webpack_require__(124),
	  count: __webpack_require__(127),
	  infinite: __webpack_require__(128),
	  empty: __webpack_require__(129),
	  error: __webpack_require__(130)
	}


/***/ }),
/* 123 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	var values = __webpack_require__(124)
	module.exports = function (object) {
	  return values(Object.keys(object))
	}
	
	


/***/ }),
/* 124 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	var abortCb = __webpack_require__(125)
	
	module.exports = function values (array, onAbort) {
	  if(!array)
	    return function (abort, cb) {
	      if(abort) return abortCb(cb, abort, onAbort)
	      return cb(true)
	    }
	  if(!Array.isArray(array))
	    array = Object.keys(array).map(function (k) {
	      return array[k]
	    })
	  var i = 0
	  return function (abort, cb) {
	    if(abort)
	      return abortCb(cb, abort, onAbort)
	    if(i >= array.length)
	      cb(true)
	    else
	      cb(null, array[i++])
	  }
	}


/***/ }),
/* 125 */
/***/ (function(module, exports) {

	module.exports = function abortCb(cb, abort, onAbort) {
	  cb(abort)
	  onAbort && onAbort(abort === true ? null: abort)
	  return
	}
	


/***/ }),
/* 126 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	var abortCb = __webpack_require__(125)
	
	module.exports = function once (value, onAbort) {
	  return function (abort, cb) {
	    if(abort)
	      return abortCb(cb, abort, onAbort)
	    if(value != null) {
	      var _value = value; value = null
	      cb(null, _value)
	    } else
	      cb(true)
	  }
	}
	
	


/***/ }),
/* 127 */
/***/ (function(module, exports) {

	'use strict'
	
	module.exports = function count (max) {
	  var i = 0; max = max || Infinity
	  return function (end, cb) {
	    if(end) return cb && cb(end)
	    if(i > max)
	      return cb(true)
	    cb(null, i++)
	  }
	}
	
	


/***/ }),
/* 128 */
/***/ (function(module, exports) {

	'use strict'
	module.exports = function infinite (generate) {
	  generate = generate || Math.random
	  return function (end, cb) {
	    if(end) return cb && cb(end)
	    return cb(null, generate())
	  }
	}
	
	


/***/ }),
/* 129 */
/***/ (function(module, exports) {

	'use strict'
	//a stream that ends immediately.
	module.exports = function empty () {
	  return function (abort, cb) {
	    cb(true)
	  }
	}


/***/ }),
/* 130 */
/***/ (function(module, exports) {

	'use strict'
	//a stream that errors immediately.
	module.exports = function error (err) {
	  return function (abort, cb) {
	    cb(err)
	  }
	}
	


/***/ }),
/* 131 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	module.exports = {
	  drain: __webpack_require__(132),
	  onEnd: __webpack_require__(133),
	  log: __webpack_require__(134),
	  find: __webpack_require__(135),
	  reduce: __webpack_require__(137),
	  collect: __webpack_require__(138),
	  concat: __webpack_require__(139)
	}
	


/***/ }),
/* 132 */
/***/ (function(module, exports) {

	'use strict'
	
	module.exports = function drain (op, done) {
	  var read, abort
	
	  function sink (_read) {
	    read = _read
	    if(abort) return sink.abort()
	    //this function is much simpler to write if you
	    //just use recursion, but by using a while loop
	    //we do not blow the stack if the stream happens to be sync.
	    ;(function next() {
	        var loop = true, cbed = false
	        while(loop) {
	          cbed = false
	          read(null, function (end, data) {
	            cbed = true
	            if(end = end || abort) {
	              loop = false
	              if(done) done(end === true ? null : end)
	              else if(end && end !== true)
	                throw end
	            }
	            else if(op && false === op(data) || abort) {
	              loop = false
	              read(abort || true, done || function () {})
	            }
	            else if(!loop){
	              next()
	            }
	          })
	          if(!cbed) {
	            loop = false
	            return
	          }
	        }
	      })()
	  }
	
	  sink.abort = function (err, cb) {
	    if('function' == typeof err)
	      cb = err, err = true
	    abort = err || true
	    if(read) return read(abort, cb || function () {})
	  }
	
	  return sink
	}


/***/ }),
/* 133 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var drain = __webpack_require__(132)
	
	module.exports = function onEnd (done) {
	  return drain(null, done)
	}


/***/ }),
/* 134 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var drain = __webpack_require__(132)
	
	module.exports = function log (done) {
	  return drain(function (data) {
	    console.log(data)
	  }, done)
	}


/***/ }),
/* 135 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	function id (e) { return e }
	var prop = __webpack_require__(136)
	var drain = __webpack_require__(132)
	
	module.exports = function find (test, cb) {
	  var ended = false
	  if(!cb)
	    cb = test, test = id
	  else
	    test = prop(test) || id
	
	  return drain(function (data) {
	    if(test(data)) {
	      ended = true
	      cb(null, data)
	    return false
	    }
	  }, function (err) {
	    if(ended) return //already called back
	    cb(err === true ? null : err, null)
	  })
	}
	
	
	
	


/***/ }),
/* 136 */
/***/ (function(module, exports) {

	module.exports = function prop (key) {
	  return key && (
	    'string' == typeof key
	    ? function (data) { return data[key] }
	    : 'object' === typeof key && 'function' === typeof key.exec //regexp
	    ? function (data) { var v = key.exec(data); return v && v[0] }
	    : key
	  )
	}


/***/ }),
/* 137 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var drain = __webpack_require__(132)
	
	module.exports = function reduce (reducer, acc, cb ) {
	  if(!cb) cb = acc, acc = null
	  var sink = drain(function (data) {
	    acc = reducer(acc, data)
	  }, function (err) {
	    cb(err, acc)
	  })
	  if (arguments.length === 2)
	    return function (source) {
	      source(null, function (end, data) {
	        //if ended immediately, and no initial...
	        if(end) return cb(end === true ? null : end)
	        acc = data; sink(source)
	      })
	    }
	  else
	    return sink
	}


/***/ }),
/* 138 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var reduce = __webpack_require__(137)
	
	module.exports = function collect (cb) {
	  return reduce(function (arr, item) {
	    arr.push(item)
	    return arr
	  }, [], cb)
	}


/***/ }),
/* 139 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var reduce = __webpack_require__(137)
	
	module.exports = function concat (cb) {
	  return reduce(function (a, b) {
	    return a + b
	  }, '', cb)
	}


/***/ }),
/* 140 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	module.exports = {
	  map: __webpack_require__(141),
	  asyncMap: __webpack_require__(142),
	  filter: __webpack_require__(143),
	  filterNot: __webpack_require__(145),
	  through: __webpack_require__(146),
	  take: __webpack_require__(147),
	  unique: __webpack_require__(148),
	  nonUnique: __webpack_require__(149),
	  flatten: __webpack_require__(150)
	}
	
	
	


/***/ }),
/* 141 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	function id (e) { return e }
	var prop = __webpack_require__(136)
	
	module.exports = function map (mapper) {
	  if(!mapper) return id
	  mapper = prop(mapper)
	  return function (read) {
	    return function (abort, cb) {
	      read(abort, function (end, data) {
	        try {
	        data = !end ? mapper(data) : null
	        } catch (err) {
	          return read(err, function () {
	            return cb(err)
	          })
	        }
	        cb(end, data)
	      })
	    }
	  }
	}


/***/ }),
/* 142 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	function id (e) { return e }
	var prop = __webpack_require__(136)
	
	module.exports = function asyncMap (map) {
	  if(!map) return id
	  map = prop(map)
	  var busy = false, abortCb, aborted
	  return function (read) {
	    return function next (abort, cb) {
	      if(aborted) return cb(aborted)
	      if(abort) {
	        aborted = abort
	        if(!busy) read(abort, cb)
	        else read(abort, function () {
	          //if we are still busy, wait for the mapper to complete.
	          if(busy) abortCb = cb
	          else cb(abort)
	        })
	      }
	      else
	        read(null, function (end, data) {
	          if(end) cb(end)
	          else if(aborted) cb(aborted)
	          else {
	            busy = true
	            map(data, function (err, data) {
	              busy = false
	              if(aborted) {
	                cb(aborted)
	                abortCb(aborted)
	              }
	              else if(err) next (err, cb)
	              else cb(null, data)
	            })
	          }
	        })
	    }
	  }
	}
	
	


/***/ }),
/* 143 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var tester = __webpack_require__(144)
	
	module.exports = function filter (test) {
	  //regexp
	  test = tester(test)
	  return function (read) {
	    return function next (end, cb) {
	      var sync, loop = true
	      while(loop) {
	        loop = false
	        sync = true
	        read(end, function (end, data) {
	          if(!end && !test(data))
	            return sync ? loop = true : next(end, cb)
	          cb(end, data)
	        })
	        sync = false
	      }
	    }
	  }
	}
	


/***/ }),
/* 144 */
/***/ (function(module, exports, __webpack_require__) {

	var prop = __webpack_require__(136)
	
	function id (e) { return e }
	
	module.exports = function tester (test) {
	  return (
	    'object' === typeof test && 'function' === typeof test.test //regexp
	    ? function (data) { return test.test(data) }
	    : prop (test) || id
	  )
	}


/***/ }),
/* 145 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var tester = __webpack_require__(144)
	var filter = __webpack_require__(143)
	
	module.exports = function filterNot (test) {
	  test = tester(test)
	  return filter(function (data) { return !test(data) })
	}


/***/ }),
/* 146 */
/***/ (function(module, exports) {

	'use strict'
	
	//a pass through stream that doesn't change the value.
	module.exports = function through (op, onEnd) {
	  var a = false
	
	  function once (abort) {
	    if(a || !onEnd) return
	    a = true
	    onEnd(abort === true ? null : abort)
	  }
	
	  return function (read) {
	    return function (end, cb) {
	      if(end) once(end)
	      return read(end, function (end, data) {
	        if(!end) op && op(data)
	        else once(end)
	        cb(end, data)
	      })
	    }
	  }
	}


/***/ }),
/* 147 */
/***/ (function(module, exports) {

	'use strict'
	
	//read a number of items and then stop.
	module.exports = function take (test, opts) {
	  opts = opts || {}
	  var last = opts.last || false // whether the first item for which !test(item) should still pass
	  var ended = false
	  if('number' === typeof test) {
	    last = true
	    var n = test; test = function () {
	      return --n
	    }
	  }
	
	  return function (read) {
	
	    function terminate (cb) {
	      read(true, function (err) {
	        last = false; cb(err || true)
	      })
	    }
	
	    return function (end, cb) {
	      if(ended)            last ? terminate(cb) : cb(ended)
	      else if(ended = end) read(ended, cb)
	      else
	        read(null, function (end, data) {
	          if(ended = ended || end) {
	            //last ? terminate(cb) :
	            cb(ended)
	          }
	          else if(!test(data)) {
	            ended = true
	            last ? cb(null, data) : terminate(cb)
	          }
	          else
	            cb(null, data)
	        })
	    }
	  }
	}


/***/ }),
/* 148 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	function id (e) { return e }
	var prop = __webpack_require__(136)
	var filter = __webpack_require__(143)
	
	//drop items you have already seen.
	module.exports = function unique (field, invert) {
	  field = prop(field) || id
	  var seen = {}
	  return filter(function (data) {
	    var key = field(data)
	    if(seen[key]) return !!invert //false, by default
	    else seen[key] = true
	    return !invert //true by default
	  })
	}
	


/***/ }),
/* 149 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var unique = __webpack_require__(148)
	
	//passes an item through when you see it for the second time.
	module.exports = function nonUnique (field) {
	  return unique(field, true)
	}


/***/ }),
/* 150 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict'
	
	var values = __webpack_require__(124)
	var once = __webpack_require__(126)
	
	//convert a stream of arrays or streams into just a stream.
	module.exports = function flatten () {
	  return function (read) {
	    var _read
	    return function (abort, cb) {
	      if (abort) { //abort the current stream, and then stream of streams.
	        _read ? _read(abort, function(err) {
	          read(err || abort, cb)
	        }) : read(abort, cb)
	      }
	      else if(_read) nextChunk()
	      else nextStream()
	
	      function nextChunk () {
	        _read(null, function (err, data) {
	          if (err === true) nextStream()
	          else if (err) {
	            read(true, function(abortErr) {
	              // TODO: what do we do with the abortErr?
	              cb(err)
	            })
	          }
	          else cb(null, data)
	        })
	      }
	      function nextStream () {
	        _read = null
	        read(null, function (end, stream) {
	          if(end)
	            return cb(end)
	          if(Array.isArray(stream) || stream && 'object' === typeof stream)
	            stream = values(stream)
	          else if('function' != typeof stream)
	            stream = once(stream)
	          _read = stream
	          nextChunk()
	        })
	      }
	    }
	  }
	}
	


/***/ }),
/* 151 */
/***/ (function(module, exports) {

	'use strict'
	
	module.exports = function pull (a) {
	  var length = arguments.length
	  if (typeof a === 'function' && a.length === 1) {
	    var args = new Array(length)
	    for(var i = 0; i < length; i++)
	      args[i] = arguments[i]
	    return function (read) {
	      if (args == null) {
	        throw new TypeError("partial sink should only be called once!")
	      }
	
	      // Grab the reference after the check, because it's always an array now
	      // (engines like that kind of consistency).
	      var ref = args
	      args = null
	
	      // Prioritize common case of small number of pulls.
	      switch (length) {
	      case 1: return pull(read, ref[0])
	      case 2: return pull(read, ref[0], ref[1])
	      case 3: return pull(read, ref[0], ref[1], ref[2])
	      case 4: return pull(read, ref[0], ref[1], ref[2], ref[3])
	      default:
	        ref.unshift(read)
	        return pull.apply(null, ref)
	      }
	    }
	  }
	
	  var read = a
	
	  if (read && typeof read.source === 'function') {
	    read = read.source
	  }
	
	  for (var i = 1; i < length; i++) {
	    var s = arguments[i]
	    if (typeof s === 'function') {
	      read = s(read)
	    } else if (s && typeof s === 'object') {
	      s.sink(read)
	      read = s.source
	    }
	  }
	
	  return read
	}


/***/ }),
/* 152 */
/***/ (function(module, exports) {

	'use strict'
	
	module.exports = 'ipfs-pubsub-room/v1'


/***/ }),
/* 153 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(Buffer) {'use strict'
	
	const EventEmitter = __webpack_require__(118)
	const pull = __webpack_require__(121)
	const Pushable = __webpack_require__(154)
	
	const PROTOCOL = __webpack_require__(152)
	
	module.exports = class Connection extends EventEmitter {
	  constructor (id, ipfs, room) {
	    super()
	    this._id = id
	    this._ipfs = ipfs
	    this._room = room
	    this._connection = null
	    this._connecting = false
	  }
	
	  push (message) {
	    if (this._connection) {
	      this._connection.push(encode(message))
	    } else {
	      if (!this._connecting) {
	        this._getConnection()
	      }
	      this.once('connect', () => {
	        this.push(message)
	      })
	    }
	  }
	
	  stop () {
	    if (this._connection) {
	      this._connection.end()
	    }
	  }
	
	  _getConnection () {
	    this._connecting = true
	    this._getPeerAddresses(this._id, (err, peerAddresses) => {
	      if (err) {
	        this.emit('error', err)
	        return // early
	      }
	
	      if (!peerAddresses.length) {
	        this.emit('error', new Error('could not connect to ' + this._id))
	        return // early
	      }
	
	      this._ipfs._libp2pNode.dial(peerAddresses[0], PROTOCOL, (err, conn) => {
	        if (err) {
	          this.emit('error', err)
	          return // early
	        }
	        this._connecting = false
	        const pushable = Pushable()
	        this._connection = pushable
	        pull(
	          pushable,
	          conn,
	          pull.onEnd((err) => {
	            delete this._connection
	            if (err) {
	              this.emit('error', err)
	            }
	          })
	        )
	        this.emit('connect', pushable)
	      })
	    })
	  }
	
	  _getPeerAddresses (peerId, callback) {
	    this._ipfs.swarm.peers((err, peersAddresses) => {
	      if (err) {
	        callback(err)
	        return // early
	      }
	
	      callback(
	        null,
	        peersAddresses
	          .filter(
	            (peerAddress) => peerAddress.peer.id.toB58String() === peerId)
	          .map(peerAddress => peerAddress.addr)
	      )
	    })
	  }
	}
	
	function encode (_message) {
	  let message = _message
	  if (!Buffer.isBuffer(message)) {
	    message = Buffer.from(message)
	  }
	  return message
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(107).Buffer))

/***/ }),
/* 154 */
/***/ (function(module, exports) {

	module.exports = pullPushable
	
	function pullPushable (separated, onClose) {
	  if (typeof separated === 'function') {
	    onClose = separated
	    separated = false
	  }
	
	  // create a buffer for data
	  // that have been pushed
	  // but not yet pulled.
	  var buffer = []
	
	  // a pushable is a source stream
	  // (abort, cb) => cb(end, data)
	  //
	  // when pushable is pulled,
	  // keep references to abort and cb
	  // so we can call back after
	  // .end(end) or .push(data)
	  var abort, cb
	  function read (_abort, _cb) {
	    if (_abort) {
	      abort = _abort
	      // if there is already a cb waiting, abort it.
	      if (cb) callback(abort)
	    }
	    cb = _cb
	    drain()
	  }
	
	  var ended
	  function end (end) {
	    ended = ended || end || true
	    // attempt to drain
	    drain()
	  }
	
	  function push (data) {
	    if (ended) return
	    // if sink already waiting,
	    // we can call back directly.
	    if (cb) {
	      callback(abort, data)
	      return
	    }
	    // otherwise push data and
	    // attempt to drain
	    buffer.push(data)
	    drain()
	  }
	
	  // Return functions separated from source { push, end, source }
	  if (separated) {
	    return { push: push, end: end, source: read }
	  }
	
	  // Return normal
	  read.push = push
	  read.end = end
	  return read
	
	  // `drain` calls back to (if any) waiting
	  // sink with abort, end, or next data.
	  function drain () {
	    if (!cb) return
	
	    if (abort) callback(abort)
	    else if (!buffer.length && ended) callback(ended)
	    else if (buffer.length) callback(null, buffer.shift())
	  }
	
	  // `callback` calls back to waiting sink,
	  // and removes references to sink cb.
	  function callback (err, val) {
	    var _cb = cb
	    // if error and pushable passed onClose, call it
	    // the first time this stream ends or errors.
	    if (err && onClose) {
	      var c = onClose
	      onClose = null
	      c(err === true ? null : err)
	    }
	    cb = null
	    _cb(err, val)
	  }
	}


/***/ }),
/* 155 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();
	
	exports.App = App;
	
	var _dom = __webpack_require__(9);
	
	var _xstream = __webpack_require__(3);
	
	var _xstream2 = _interopRequireDefault(_xstream);
	
	var _debounce = __webpack_require__(156);
	
	var _debounce2 = _interopRequireDefault(_debounce);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function intent(_ref) {
	  var DOM = _ref.DOM,
	      Room = _ref.Room;
	
	  var message$ = DOM.select('.message-input').events('change');
	
	  var elem$ = message$.map(function (ev) {
	    return ev.target;
	  });
	
	  var addMessage$ = message$.map(function (ev) {
	    return ev.target.value;
	  }).filter(function (val) {
	    return val.trim();
	  });
	
	  var newMessage$ = Room;
	
	  var changeUsername$ = DOM.select('.username').events('input').compose((0, _debounce2.default)(500)).map(function (ev) {
	    return ev.target.value;
	  }).filter(function (val) {
	    return val.length > 0;
	  });
	
	  return { elem$: elem$, addMessage$: addMessage$, newMessage$: newMessage$, changeUsername$: changeUsername$ };
	}
	
	function model(actions) {
	  var messages$ = actions.newMessage$.map(function (message) {
	    return function (state) {
	      return Object.assign({}, state, { messages: state.messages.concat(message.data.toString()) });
	    };
	  });
	
	  var username$ = actions.changeUsername$.map(function (username) {
	    return function (state) {
	      return Object.assign({}, state, { username: username });
	    };
	  });
	
	  var state$ = _xstream2.default.merge(messages$, username$).fold(function (state, action) {
	    return action(state);
	  }, { messages: [], username: '' }).startWith({ messages: [], username: '' });
	
	  return state$;
	}
	
	function formatAMPM(date) {
	  var hours = date.getHours();
	  var minutes = date.getMinutes();
	  var ampm = hours >= 12 ? 'PM' : 'AM';
	  hours = hours % 12;
	  hours = hours ? hours : 12; // the hour '0' should be '12'
	  minutes = minutes < 10 ? '0' + minutes : minutes;
	  var strTime = hours + ':' + minutes + ' ' + ampm;
	  return strTime;
	}
	
	function chatBubble(me, message) {
	  var date = formatAMPM(new Date());
	  return me ? (0, _dom.li)('', { attrs: { style: 'width:100%' } }, [(0, _dom.div)('.msj.macro', [(0, _dom.div)('.avatar', [(0, _dom.img)('.img-circle', { attrs: { style: 'width:100%', src: '/images/me.jpg' } })]), (0, _dom.div)('.text.text-l', [(0, _dom.p)(message), (0, _dom.p)((0, _dom.small)(date))])])]) : (0, _dom.li)('', { attrs: { style: 'width:100%' } }, [(0, _dom.div)('.msj-rta.macro', [(0, _dom.div)('.text.text-r', [(0, _dom.p)(message), (0, _dom.p)((0, _dom.small)(date))]), (0, _dom.div)('.avatar', { attrs: { style: 'padding:0px 0px 0px 10px !important' } }, [(0, _dom.img)('.img-circle', { attrs: { style: 'width:100%', src: '/images/them.jpg' } })])])]);
	}
	
	function view(state$) {
	  return state$.map(function (state) {
	    return (0, _dom.div)([(0, _dom.div)('.bg-primary.col-sm-3.col-sm-offset-4', [(0, _dom.span)('.pull-right', { attrs: { style: 'padding-top: 8px' } }, [(0, _dom.a)('.github-button.pull-right', { attrs: { href: 'https://github.com/balbany/ipfs-cycle-demo' } }, 'View Code')]), (0, _dom.h4)('IPFS-CycleJS Chat Demo')]), (0, _dom.div)('.col-sm-3.col-sm-offset-4.frame', [(0, _dom.ul)(state.messages.map(function (message) {
	      return chatBubble(message.substring(0, message.lastIndexOf(':')) === state.username, message);
	    })), (0, _dom.div)('.msj-rta.macro', { attrs: { style: 'margin:auto' } }, [(0, _dom.div)('.text.text-l', { attrs: { style: 'background:whitesmoke !important' } }, [(0, _dom.input)('.username.mytext', { attrs: { type: 'text', placeholder: 'Type a username' } })]), (0, _dom.div)('.text.text-r', { attrs: { style: 'background:whitesmoke !important' } }, [(0, _dom.input)('.message-input.mytext', { attrs: { type: 'text', placeholder: 'Type a message' } })])])])]);
	  });
	}
	
	function App(sources) {
	
	  var actions = intent(sources);
	  var vtree$ = view(model(actions));
	
	  var outgoing$ = _xstream2.default.combine(actions.addMessage$, actions.changeUsername$).map(function (_ref2) {
	    var _ref3 = _slicedToArray(_ref2, 2),
	        message = _ref3[0],
	        username = _ref3[1];
	
	    return username + ': ' + message;
	  });
	
	  var sinks = {
	    DOM: vtree$,
	    Room: outgoing$,
	    ClearInput: actions.elem$
	  };
	
	  return sinks;
	}

/***/ }),
/* 156 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	var index_1 = __webpack_require__(3);
	var DebounceOperator = (function () {
	    function DebounceOperator(dt, ins) {
	        this.dt = dt;
	        this.ins = ins;
	        this.type = 'debounce';
	        this.out = null;
	        this.id = null;
	    }
	    DebounceOperator.prototype._start = function (out) {
	        this.out = out;
	        this.ins._add(this);
	    };
	    DebounceOperator.prototype._stop = function () {
	        this.ins._remove(this);
	        this.out = null;
	        this.id = null;
	    };
	    DebounceOperator.prototype.clearInterval = function () {
	        var id = this.id;
	        if (id !== null) {
	            clearInterval(id);
	        }
	        this.id = null;
	    };
	    DebounceOperator.prototype._n = function (t) {
	        var _this = this;
	        var u = this.out;
	        if (!u)
	            return;
	        this.clearInterval();
	        this.id = setInterval(function () {
	            _this.clearInterval();
	            u._n(t);
	        }, this.dt);
	    };
	    DebounceOperator.prototype._e = function (err) {
	        var u = this.out;
	        if (!u)
	            return;
	        this.clearInterval();
	        u._e(err);
	    };
	    DebounceOperator.prototype._c = function () {
	        var u = this.out;
	        if (!u)
	            return;
	        this.clearInterval();
	        u._c();
	    };
	    return DebounceOperator;
	}());
	/**
	 * Delays events until a certain amount of silence has passed. If that timespan
	 * of silence is not met the event is dropped.
	 *
	 * Marble diagram:
	 *
	 * ```text
	 * --1----2--3--4----5|
	 *     debounce(60)
	 * -----1----------4--|
	 * ```
	 *
	 * Example:
	 *
	 * ```js
	 * import fromDiagram from 'xstream/extra/fromDiagram'
	 * import debounce from 'xstream/extra/debounce'
	 *
	 * const stream = fromDiagram('--1----2--3--4----5|')
	 *  .compose(debounce(60))
	 *
	 * stream.addListener({
	 *   next: i => console.log(i),
	 *   error: err => console.error(err),
	 *   complete: () => console.log('completed')
	 * })
	 * ```
	 *
	 * ```text
	 * > 1
	 * > 4
	 * > completed
	 * ```
	 *
	 * @param {number} period The amount of silence required in milliseconds.
	 * @return {Stream}
	 */
	function debounce(period) {
	    return function debounceOperator(ins) {
	        return new index_1.Stream(new DebounceOperator(period, ins));
	    };
	}
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = debounce;
	//# sourceMappingURL=debounce.js.map

/***/ })
/******/ ]);