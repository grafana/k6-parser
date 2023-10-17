# k6-parser
This tool parses k6 archives and extracts information about:
- What's being imported.
- How many times those imports are being used.

> Note: ATM, this tool doesn't bundle and parse the HTTP/HTTPS imports, only the local ones.

## Usage

You need to have Node.js (> v16.15.0) installed. 

Once you've cloned this repo, run the following commands:
```
$ npm install
$ node parse.js
📦 No archive specified, using default archive.tar
✨ Bundle phase completed
✨ Analyze phase completed
📜 Result saved to parse_dsijse/result.json
```

By default, the tool will use the `archive.tar` file in the root of the repo. If you want to use a different archive, you can specify it as a command line argument:
```
$ node parse.js my-archive.tar
```

That's it! You should see something like this in the result.json file available in the `parse_"id"` folder:
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

# But: What if I want to run this tool in a server?

If you pass the `--server` flag, the tool will start a server that will listen for POST requests in the `/parse` endpoint.

Then, you can use cURL (or any other tool) to parse a specific archive:
```bash
curl -X POST -F "archive=@archive.tar" http://localhost:3000/parse | jq '.'

  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  467k  100   177  100  467k     12  32480  0:00:14  0:00:14 --:--:--    44
{
  "imports": [
    {
      "source": "k6",
      "specifiers": [
        {
          "name": "check",
          "usage": 4
        },
        {
          "name": "group",
          "usage": 4
        }
      ]
    },
    {
      "source": "k6/http",
      "specifiers": [
        {
          "name": "http",
          "usage": {
            "post": 2,
            "get": 2
          }
        }
      ]
    }
  ]
}
```