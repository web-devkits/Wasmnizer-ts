# libdyntype with simple implementation

This folder provides a simplified implementation of libdyntype without dependency to QuickJS, this may be useful especially on some resource constraint devices.

> Note: this simple implementation of libdyntype doesn't support these features:
>  - Use JavaScript builtin object and their methods (such as JSON, JSON.stringify, Map, Map.prototype.get ...)
>  - prototype
>  - string encoding (all strings are stored as raw binary buffer without any encoding)
