#!/usr/bin/env bash

set -eu

docker-compose -f docker-compose.yml down --remove-orphans
