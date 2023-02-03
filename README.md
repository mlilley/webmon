# webmon

Monitor for changes in webpages. 

Select only the parts of a page you're interested in using one or more xpaths.

# Config

Create a pages.json to specify what to monitor (see example in pages.example.json):

```
# pages.json
[{ 
    "id": "google_home",                     # must be filesystem safe
    "url": "https://www.google.com/",        # url of page to monitor
    "xpaths": [ "//form[@role='search']" ]   # xpaths to bits of page to monitor
}]
```

Note: requires a diff command to be present on the host system.