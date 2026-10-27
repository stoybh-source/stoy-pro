services:
    - type: web
    name: astoy-pro
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
            - key: NODE_VERSION
        value: 18