Imported from the Claude Design project (6e20b766-be50-47b3-b062-e39b441c174a).

PNGs here are the originals as exported. The three SVGs (star, flag-gb,
flag-ro) were fetched too, but each is a ~300-byte icon wrapped in a ~10 KB
C2PA signing manifest; only the sanitized icons (metadata, comments and
namespaces stripped) are kept, in ../../assets/. 

Not here, because the design tool's file API caps downloads at 256 KiB and
these exceed it: foxy.png, foxy-dress.png, husky.png, husky-tactical.png,
item-armor.png, item-helmet.png. Export them manually, drop them in this
folder, and run `sh scripts/images.sh`.
