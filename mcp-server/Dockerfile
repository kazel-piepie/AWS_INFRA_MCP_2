FROM node:24-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip git less jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- runtime stage ---
FROM node:24-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip git less jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# AWS CLI
RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscli.zip \
    && unzip -q /tmp/awscli.zip -d /tmp/aws \
    && /tmp/aws/aws/install \
    && rm -rf /tmp/awscli.zip /tmp/aws

# Terraform
RUN TERRAFORM_VERSION="1.9.8" \
    && curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip" \
       -o /tmp/terraform.zip \
    && unzip -q /tmp/terraform.zip -d /usr/local/bin \
    && rm /tmp/terraform.zip

# gh CLI
RUN GH_VERSION="2.63.2" \
    && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
       -o /tmp/gh.tar.gz \
    && tar -xzf /tmp/gh.tar.gz -C /tmp \
    && mv /tmp/gh_${GH_VERSION}_linux_amd64/bin/gh /usr/local/bin/gh \
    && rm -rf /tmp/gh.tar.gz /tmp/gh_${GH_VERSION}_linux_amd64

# Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# non-root user
RUN groupadd -r mcpuser && useradd -r -g mcpuser -m -d /home/mcpuser mcpuser

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY CLAUDE.md ./
COPY docs/ ./docs/

RUN mkdir -p /home/mcpuser/.claude && chown -R mcpuser:mcpuser /app /home/mcpuser

ENV HOME=/home/mcpuser
ENV NODE_ENV=production
ENV PORT=3000
ENV AWS_PAGER=""

USER mcpuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
