# k6-parser
This tool parses k6 archives and extracts information about:
- What's being imported.
- How those imports are being used (e.g. how many times).

## Usage

You need to have Node.js (> v16.15.0) installed. 

Once you've cloned this repo, run the following commands:
```
$ npm install
$ node parse.js
📦 No archive specified, using default archive.tar
✨ Bundle phase completed
✨ Analyze phase completed
📜 Result saved to result.json
```

By default, the tool will use the `archive.tar` file in the root of the repo. If you want to use a different archive, you can specify it as a command line argument:
```
$ node parse.js my-archive.tar
```

That's it! You should see something like this in the result.json file:
```json
{
  "imports": [
    {
      "source": "k6/http",
      "specifiers": [
        {
          "name": "http",
          "usage": {
            "get": 1,
            "post": 1
          }
        }
      ]
    },
    {
      "source": "k6",
      "specifiers": [
        {
          "name": "check",
          "usage": 3
        },
        {
          "name": "sleep",
          "usage": 1
        }
      ]
    },
    {
      "source": "k6/metrics",
      "specifiers": [
        {
          "name": "Counter",
          "usage": 1
        },
        {
          "name": "Trend",
          "usage": 1
        }
      ]
    },
    {
      "source": "https://jslib.k6.io/k6-summary/0.0.2/index.js",
      "specifiers": [
        {
          "name": "textSummary",
          "usage": 1
        }
      ]
    },
    {
      "source": "k6/data",
      "specifiers": [
        {
          "name": "SharedArray",
          "usage": 1
        }
      ]
    },
    {
      "source": "k6/experimental/browser",
      "specifiers": [
        {
          "name": "chromium",
          "usage": {
            "launch": 1
          }
        }
      ]
    }
  ]
}
```

### But: How do I generate a k6 archive?

If you don't have a k6 archive, you can generate one using the `k6 archive` command. For example:
```
$ k6 archive -o archive.tar script.js
```
