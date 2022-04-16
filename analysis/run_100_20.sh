#!/bin/bash

for lib in "collabs" "yjs" "automerge"
do
  npm start -- results.txt $lib 100 20 7
done
