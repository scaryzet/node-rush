# Rush

The ultimate solution of writing asyncronous code in a beautiful way.

# Installation

```
npm install rush
```

# Example

```javascript
var rush = require('rush');
var fs = require('fs');

rush({
	n: 0
	data: []
})(function() {
	this.n++;
	
	fs.readFile('file1.txt', this(function(data) {
		this.data.push(data);
	}));
	
	fs.readFile('file2.txt', this(function(data) {
		this.data.push(data);
	}));
})(function() {
	this.n++;
	
	fs.readFile('file3.txt', this(function(data) {
		this.data.push(data);
	}));
})(function(err) {
	if (err) {
		// Handle the error.
		return;
	}

	console.log(n); // => 2

	// this.data should have 3 items:
	// (data of) file1, file2, file3 or file2, file1, file3.
})();

```

# Important

## Multiple initializers are not working as intended currently.

You can use multiple initializers (passing of an object to Rush), but all these objects will be used like as you passed a single merged object at the beginning of the chain.

Don't rely on such behaviour, it will be fixed later.

```javascript
rush({
	x: 2
})(function() {
	console.log(x); // Logs 3, but not 2!
})({
	x: 3
})(function() {
	console.log(x); // Logs 3 as intended.
})(function(err) {
	check(!err);
})();
```

You can use regular blocks instead of initializers, as blocks are executed strictly one after another (if there are no errors in them).

# License

MIT
