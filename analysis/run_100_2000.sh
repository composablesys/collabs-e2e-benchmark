#!/bin/bash

for lib in "collabs" "yjs" "automerge"
do
  npm start -- results.txt $lib 100 2000
done
