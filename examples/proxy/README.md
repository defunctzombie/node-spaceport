Proxy spaceport example shows how to use spaceport with a web proxy setup. The idea is that you have a node.js proxy accepting outside connections and some backend processes which are the actual webservers.

The example shows how you don't need to know what ports the backend servers will be on or how many there will be. You can just have the proxy running and it will send requests to any available backend once it comes online.

# use

Launch the main proxy app
```
node proxy
```

Launch any number of backend webservers
```
node server
node server
```

Watch the requests round robin
```
curl localhost:8000
```

