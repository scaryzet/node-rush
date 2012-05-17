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
	// to "seal" them in case of a task failure in a block.
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
		// This function will be called instead of the original task callback.

		var callback = info.callbacks[index]; // [ callback, errorHandler | null ]

		if (!callback[0]) {
			// Task callbacks in the block have been "sealed" (the block has failed).
			// Just do nothing.
			return;
		}

		info.numFinishedCallbacks++;
		var err = null;

		// Handle the first "err" argument.
		if (arguments.length != 0) {
			err = arguments[0];

			if (err) {
				if (!callback[1]) {
					this.__error(err);
					return;
				} else {
					// We have a task error handler. Call it.
					// If it throws, report block failure to the chainer.
					try {
						callback[1].call(this, err);
					} catch(err2) {
						this.__error(err2);
						return;
					}

					// We're getting here if the block error handler has suppressed the error.
					// We shouldn't let the original task callback to be executed,
					// but we want to get to the end of our wrapper function, to its final section.
					// Thus "!err &&" below.
				}
			}
		}

		// Call the callback.
		if (!err && callback[0]) {
			try {
				callback[0].apply(this, Array.prototype.slice.call(arguments, 1))
			} catch(err) {
				this.__error(err);
				return;
			}
		}

		// Have we finished?
		if (info.numFinishedCallbacks == info.numCallbacks)
			this.__onFinish(); // __onFinish() is bound, so it's ok to call it in such a way.
	}.bind(this);
};

var rushBlockContextStatePrototype = {
	__error: function(error) {
		// This reports to the chainer that a block has failed.

		this.__sealCallbacks();
		this.__onError(error);
	},
	__sealCallbacks: function() {
		// "Seals" all callbacks for current block index.

		var callbacks = this.__blockInfos[this.__blockIndex].callbacks;

		for (var i = 0, ni = callbacks.length; i < ni; i++)
			callbacks[i][0] = null;
	}
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
		this.chain.push([ arg0, arg1 ]);
	} else {
		throw new Error('Invalid number of arguments passed to Rush.');
	}

	return this.chainer;
};

var rushChainerStatePrototype = {
	executeChain: function() {
		if (this.chain.length < 2)
			throw new Error('An attempt to execute an too short Rush chain. A chain must have one or more blocks and a finalizer.');

		var finalizer = this.chain.pop();

		if (finalizer[1] !== null)
			throw new Error('Finalizer should be passed as a single argument.');

		this.finalizer = finalizer[0];

		// Bind the function to the result of this binding.
		// Blocks, task callbacks and error handlers will be executed in context
		// of "context", which should be both a function and an object to let us
		// use "this()" and "this.something".
		// Also, Contexter function should also be executed in context of "context"
		// (as we want to control Contexter at low level via methods
		// of that "this": "start()", "end()", "error()").
		var context = function() {
			return rushBlockContexter.apply(context, arguments);
		};

		context.__proto__ = this.context;
		context.__proto__.__proto__ = rushBlockContextStatePrototype;
		context.__blockIndex = -1; // At the first iteration it will be incremented to 0.
		context.__blockInfos = []; // [ { callbacks, numCallbacks, numFinishedCallbacks }, ... ].

		var executeNextBlock = function() {
			context.__blockIndex++;
			var blockIndex = context.__blockIndex; // We need this for a check below.

			if (blockIndex == this.chain.length) {
				this.finalizer.call(context);
				return;
			}

			context.__blockInfos.push({
				callbacks: [],
				numCallbacks: 0,
				numFinishedCallbacks: 0
			});

			var block = this.chain[blockIndex];

			try {
				block[0].call(context);
			} catch(err) {
				// Some tasks might have started before the exception,
				// so we need to seal their callbacks.
				context.__sealCallbacks();

				if (!block[1]) {
					// We don't have a block error handler. Do exit.
					this.finalizer.call(context, err);
					return;
				} else {
					// We have a block error handler. Call it.
					// If it throws, pass error to the finalizer and exit.

					try {
						block[1].call(context, err);
					} catch(err2) {
						this.finalizer.call(context, err2);
						return;
					}

					// Getting here means that the block error handler has suppressed the error.
					// Task callbacks of the block are sealed, so nothing will call __onFinish().
					// We need to execute the next block manually. And we can't leave it to
					// the last block of executeNextBlock() because numCallbacks may be not 0 there.

					executeNextBlock();
					return;
				}
			}

			if (context.__blockIndex != blockIndex) {
				// This means that all callbacks in the block got executed syncronously,
				// than the counter of finished tasks overflowed, and Contexter called __onFinish(),
				// and another block (maybe even finalizer) got executed, and context.__blockIndex
				// got incremented - everything before this point, at "block[0].call(context)" above.
				// In such a case we should do nothing and return as we don't want the final block
				// of executeNextBlock() to be executed.
				return;
			}

			if (context.__blockInfos[context.__blockIndex].numCallbacks == 0) {
				// No callbacks have been created in the block, so nothing will call __onFinish().
				// Run next block manually.
				executeNextBlock();
			}
		}.bind(this);

		context.__onFinish = executeNextBlock;

		context.__onError = function(err) {
			// Some error has happened while a block was being executed.
			// NOTE: When this is called, callbacks are already sealed (in __error()).

			var block = this.chain[context.__blockIndex];

			if (block[1]) {
				// We have a block error handler. Call it.
				// If it throws, pass error to the finalizer and exit.

				try {
					block[1].call(context, err);
				} catch(err2) {
					this.finalizer.call(context, err2);
					return;
				}

				// Getting here means that the block error handler has suppressed the error.
				// Task callbacks of the block are sealed, so nothing will call __onFinish().
				// We need to execute the next block manually.

				executeNextBlock();
				return;
			}

			// We don't have a block error handler. Do exit.
			this.finalizer.call(context, err);
		}.bind(this);

		executeNextBlock();

		// Prevent accidental double chain execution.
		this.executed = true;
	}
};

var rush = function() {
	var state = {};
	// state.__proto__ = rushChainerStatePrototype; // This would be good if we had a bunch of methods.
	state.executeChain = rushChainerStatePrototype.executeChain;
	state.chainer = rushChainer.bind(state);
	state.context = {};
	state.chain = []; // Array of [ callback, blockErrorHandler | null ].
	// state.finalizer is set in executeChain().
	// state.executed is set in executeChain() to prevent double chain execution.
	return state.chainer.apply(null, arguments);
};

module.exports = rush;
