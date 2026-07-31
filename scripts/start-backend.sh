#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 18 > /dev/null 2>&1

echo "Node: $(node --version)" >&2
echo "PWD: $(pwd)" >&2

cd /home/kscod/projects/vets/veterinaria/backend
exec node_modules/.bin/ts-node src/main.ts
