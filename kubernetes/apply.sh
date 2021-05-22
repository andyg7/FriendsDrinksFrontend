#!/usr/bin/env bash

set -eu

export manifest=$1
export img=$2
export serviceType=$3

apply_tmp=$(mktemp)
cat $manifest | envsubst | tee $apply_tmp
cat $apply_tmp
kubectl apply -f $apply_tmp
kubectl rollout status -f $apply_tmp --timeout=120s
rm -f $apply_tmp