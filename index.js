/**
 * This is not a class!
 * This is a function which wraps callbacks and also an object
 * which is the context for a Rush chain.
 */
var rushBlockContexter = function(callback, errorHandler) {
	if (typeof callback !== 'function') {
		if (typeof callback === 'undefined')
			throw new TypeError('A callback function should be passed.');

		throw new TypeError('A callback passed to be wrapped should be a function.');
	}

	if (typeof errorHandler !== 'undefined' && typeof errorHandler !== 'function')
		throw new TypeError('An error handler passed with the callback should be a function.');

	// We need to store callbacks in an array because we want to be able
	// to "turn them off" in case of a task failure in a block.
	//
	// Also we won't ever clean the __callbacks array, as the chain can have multiple blocks,
	// and a block error handler can suppress error and thus prevent the chain
	// from being stopped on a task error, so it will continue to run.

	// NOTE: __blockIndex is constant until the block finishes or fails.
	var info = this.__blockInfos[this.__blockIndex];
	var index = info.numCallbacks; // We need this, as the value of info.callbacks[index] can change.

	info.callbacks.push([ callback, errorHandler || null ]);
	info.numCallbacks++;

	return function() {
		// This function will be called instead of the original callback.

		var callback = this.__callbacks[index]; // [ callback, errorHandler | null ]

		if (!callback[0]) {
			// Task callbacks in the block have been "turned off" (the block has failed).
			// Just do nothing.
			return;
		}

		this.__numFinishedCallbacks[this.__blockIndex]++;

		// Handle the first "err" argument.
		if (arguments.length != 0) {
			var err = arguments[0];

			if (err) {
				if (!callback[1]) {
					this.__error(err);
				} else {
					// We have a task error handler. Call it.
					// If it throws, report block failure to the chainer.
					try {
						callback[1].call(this, err);
					} catch(err2) {
						this.__error(err2);
					}
				}

				return;
			}
		}

		// Call the callback.
		if (callback[0]) {
			try {
				// TODO: Write a test for a callback with more arguments than 1.
				callback[0].apply(this, Array.prototype.slice.call(arguments, 1))
			} catch(err) {
				this.__error(err);
				return;
			}
		}

		// Have we finished?
		if (this.__numFinishedCallbacks[this.__blockIndex] == this.__numCallbacks[this.__blockIndex])
			this.__finish();
	}.bind(this);
};

var rushBlockContextStatePrototype = {
	__error: function(error) {
		// This reports to the chainer that a block has failed.

		this.__sealCallbacks();
		this.__onError();
	},
	__finish: function() {
		// This reports to the chainer that all tasks in a block have finished.

		this.__onFinish();
	},
	__sealCallbacks: function() {
		// "Seals" all callbacks for current block index.

		var callbacks = this.__infos[this.__blockIndex].callbacks;

		for (var i = 0, ni = callbacks.length; i < ni; i++)
			callbacks[i][0] = null;
	}
	// wrap
	// begin
	// end
	// error
};

var rushChainer = function() {
	/*
	 * 1. An object is passed.
	 *   - Merge it into the context.
	 * 2. A function is passed.
	 *   - Add a new block to the chain.
	 * 3. No arguments passed.
	 *   - Execute the chain, mark chain as executed to suppress successive calls of chainer.
	 */
	if (this.executed)
		throw new Error('An attempt to execute a Rush chain twice or alter it after execution.');

	var numArgs = arguments.length;
	
	if (numArgs == 1) {
		var arg0 = arguments[0];

		if (typeof arg0 === 'function') {
			// A function is passed. Add a new block to the chain.
			// Adding [ callback, blockErrorHandler ].
			this.chain.push([ arg0, null ]);
		} else if (arg0 !== null && typeof arg0 === 'object') {
			// An object is passed. Merge it into the chain context.
			for (var k in arg0)
				this.context[k] = arg0[k];
		} else {
			throw new TypeError('Single argument passed to Rush should be either a function or an object.');
		}
	} else if (numArgs == 0) {
		this.executeChain();
	} else if (numArgs == 2) {
		var arg0 = arguments[0], arg1 = arguments[1];

		// Two functions should be passed.
		if (typeof arg0 !== 'function' || typeof arg1 !== 'function')
			throw new TypeError('When two arguments are passed to Rush, each of them should be a function.');

		// So, we have a block function and a block error handler.
		// Add [ callback, blockErrorHandler ] to the chain.
		this.chain.push(arg0, arg1);
	} else {
		throw new Error('Invalid number of arguments passed to Rush.');
	}

	return this.chainer;
};

var rushChainerStatePrototype = {
	executeChain: function() {
		if (this.chain.length < 2)
			throw new Error('An attempt to execute an too short Rush chain. A chain must have one or more blocks and a finalizer.');

		this.finalizer = this.chain.pop();

		if (this.finalizer[1] !== null)
			throw new Error('Finalizer should be passed as a single argument.'); // TODO: Test this.

		var context = function() {
			rushBlockContexter.apply(context, arguments);
		};

		context.__proto__ = this.context;
		context.__proto__.__proto__ = rushBlockContextStatePrototype;
		context.__blockIndex = -1; // At the first iteration it will be incremented to 0.
		context.__blockInfos = []; // [ { callbacks, numCallbacks, numFinishedCallbacks }, ... ].

		var executeNextBlock = function() {
			context.__blockIndex++;

			if (context.__blockIndex == this.chain.length) {
				this.finalizer.call(context);
				return;
			}

			context.__blockInfos.push({
				callbacks: [],
				numCallbacks: 0,
				numFinishedCallbacks: 0
			});

			var block = this.chain[context.__blockIndex];

			try {
				block[0].call(context);
			} catch(err) {
				// Some tasks might have started before the exception,
				// so we need to seal their callbacks.
				context.__sealCallbacks();

				if (!block[1]) {
					// We don't have a block error handler. Do exit.
					this.finalizer.call(context, err);
				} else {
					// We have a block error handler. Call it.
					// If it throws, pass error to the finalizer.
					try {
						block[1].call(context, err);
					} catch(err2) {
						this.finalizer.call(context, err2);
						// TODO: Write tests for this.
					}
				}
			}
		}.bind(this);

		context.__onFinish = executeNextBlock;

		context.__onError = function(err) {
			// NOTE: When this is called, callbacks are already sealed (in __error()).

			this.finalizer.call(context, err);
		}.bind(this);

		executeNextBlock();

		// Prevent accidental double chain execution.
		this.executed = true;
	}
};

var rush = function() {
	var state = {};
	state.__proto__ = rushChainerStatePrototype;
	state.chainer = rushChainer.bind(state);
	state.context = {};
	state.chain = []; // Array of [ callback, blockErrorHandler | null ].
	// state.finalizer is set in executeChain().
	// state.executed is set in executeChain() to prevent double chain execution.
	return state.chainer.apply(null, arguments);
};

module.exports = rush;
