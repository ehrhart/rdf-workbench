# Start from the specified base image
FROM node:22-bookworm

# Set working directory
WORKDIR /app

# Install required ODBC libraries
RUN apt-get update && apt-get install -y \
    libiodbc2 \
    libvirtodbc0 \
    unixodbc \
    unixodbc-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Normalize Virtuoso ODBC driver path
RUN set -e; \
    DRIVER_X86="/usr/lib/x86_64-linux-gnu/odbc/virtodbc.so"; \
    DRIVER_ARM="/usr/lib/aarch64-linux-gnu/odbc/virtodbc.so"; \
    TARGET="/usr/lib/odbc/virtodbc.so"; \
    mkdir -p /usr/lib/odbc; \
    if [ -f "$DRIVER_X86" ]; then \
        ln -s "$DRIVER_X86" "$TARGET"; \
        echo "Linked x86_64 Virtuoso driver -> $TARGET"; \
    elif [ -f "$DRIVER_ARM" ]; then \
        ln -s "$DRIVER_ARM" "$TARGET"; \
        echo "Linked ARM64 Virtuoso driver -> $TARGET"; \
    else \
        echo "Error: Virtuoso ODBC driver not found on either architecture"; \
        find / -name "virtodbc*.so"; \
        exit 1; \
    fi

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the project files
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the specified port
EXPOSE 50118

# Set environment variable to production
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]