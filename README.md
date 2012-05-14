Installation
============

The ultimate solution of writing asyncronous code in a beautiful way.

```
npm install rush
```

Example
=======

```javascript
var rush = require('rush');

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
	console.log(n); // => 2
	// this.data should have 3 items:
	// (data of) file1, file2, file3 or file2, file1, file3.
})();

```

License
=======

MIT