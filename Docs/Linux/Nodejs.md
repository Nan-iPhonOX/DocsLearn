# Download and install fnm:
curl -o- https://fnm.vercel.app/install | bash
或
curl -o- https://raw.githubusercontent.com/Schniz/fnm/refs/heads/master/.ci/install.sh | bash

# Download and install Node.js:
fnm install 22

# Verify the Node.js version:
node -v # Should print "v22.12.0".

# Download and install pnpm:
corepack enable pnpm

# Verify pnpm version:
pnpm -v
