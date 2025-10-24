/**
 * connectionManager.js
 */

const util = require("util");
const { OPCUAClient, MessageSecurityMode, SecurityPolicy, UserTokenType } = require("node-opcua");
const { OPCUACertificateManager } = require('node-opcua-certificate-manager');
const fs = require("fs").promises;
const { createPrivateKey } = require("crypto");
const certmanager = require('./certmanager');

class ConnectionManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.client = null;
        this.session = null;
        this.redundancy = 0;
        this.isSwitching = false;
        this.lastKeepAlive = Date.now();
        this.keepAliveTimeout = null;
        this.primaryCheckInterval = null;
    }

    async connect(params) {
        const {
            endpointUrl,
            auth_type,
            autogen_cert,
            certDer,
            privateKey,
            userName,
            password,
            securityPolicy,
            messageSecurityMode,
            initialDelay = 1000,
            maxRetry = 3,
            keepAliveTimeoutThreshold = 15000,
            use_redundancy = 0
        } = params;

        const connectionStrategy = {
            initialDelay,
            maxRetry,
            transportTimeout: 5000
        };

        const { clientCM, privateKeyFile, certificateDerFile, certificateFile } = await certmanager.start(
            this.plugin, 
            this.plugin.opt.pluginbasepath + "/" + this.plugin.opt.id || __dirname
        );

        if (!this.client) {
            this.client = OPCUAClient.create({
                applicationName: "IntraClient",
                connectionStrategy,
                securityMode: MessageSecurityMode[messageSecurityMode],
                securityPolicy: SecurityPolicy[securityPolicy],
                endpointMustExist: false,
                certificateFile,
                privateKeyFile,
                clientCertificateManager: clientCM
            });

            this._setupEventHandlers(params);
        }

        try {
            this.plugin.log(`Attempting to connect to ${endpointUrl}`, 2);
            await this.client.connect(endpointUrl);
            this.plugin.log(`Connected to ${endpointUrl}`, 2);

            let certificateData, privateKeyObject;
            if (auth_type == 'Certificate') {
                if (autogen_cert) {
                    certificateData = await fs.readFile(certificateDerFile);
                    const privateKeyPem = await fs.readFile(privateKeyFile, "utf8");
                    privateKeyObject = createPrivateKey({
                        key: privateKeyPem,
                        format: "pem"
                    });
                } else {
                    certificateData = await fs.readFile(certDer);
                    const privateKeyPem = await fs.readFile(privateKey, "utf8");
                    privateKeyObject = createPrivateKey({
                        key: privateKeyPem,
                        format: "pem"
                    });
                }
            }

            const userIdentityInfo = {
                type: UserTokenType[auth_type],
                userName,
                password,
                certificateData,
                privateKey: privateKeyObject
            };

            this.session = await this.client.createSession(userIdentityInfo);
            this.plugin.log("Session created!", 2);

            this.lastKeepAlive = Date.now();
            this._startKeepAliveCheck(keepAliveTimeoutThreshold);
            return true;
        } catch (err) {
            this.plugin.log(`Error occurred during connect: ${util.inspect(err)} (redundancy: ${this.redundancy})`, 2);
            await this.disconnect();
            return false;
        }
    }

    _setupEventHandlers(params) {
        this.client.on("backoff", async (retry, delay) => {
            this.plugin.log(`Backoff on ${this.redundancy == 0 ? 'primary' : 'redundant'} server, retry ${retry}, next attempt in ${delay}ms`, 2);
            if (retry >= params.maxRetry - 1) {
                this.plugin.log(`Max retries (${params.maxRetry}) exceeded on ${this.redundancy == 0 ? 'primary' : 'redundant'} server`, 2);
                await this.disconnect();
                this.plugin.log(`Disconnected from ${this.redundancy == 0 ? 'primary' : 'redundant'} server`, 2);
                if (this.redundancy == 0 && params.use_redundancy == 1) {
                    this.plugin.log(`Initiating switch to redundant server`, 2);
                    this.isSwitching = true;
                    if (this.onRedundancySwitch) {
                        await this.onRedundancySwitch('primary_failed');
                    }
                } else {
                    this.plugin.log(`No further redundancy available, exiting`, 2);
                    if (this.onConnectionLost) {
                        this.onConnectionLost('no_redundancy');
                    }
                }
            }
        });

        this.client.on("connection_lost", async () => {
            this.plugin.log("Connection lost!", 2);
            if (this.redundancy == 0 && params.use_redundancy == 1 && !this.isSwitching) {
                this.plugin.log(`Connection lost on primary server, switching to redundant`, 2);
                this.isSwitching = true;
                await this.disconnect();
                if (this.onRedundancySwitch) {
                    await this.onRedundancySwitch('connection_lost');
                }
            }
        });

        this.client.on("connection_reestablished", () => {
            this.plugin.log("Connection re-established", 2);
            if (this.onConnectionRestored) {
                this.onConnectionRestored();
            }
        });
    }

    _startKeepAliveCheck(timeoutThreshold) {
        this._stopKeepAliveCheck();
        this.keepAliveTimeout = setInterval(() => {
            const timeSinceLastKeepAlive = Date.now() - this.lastKeepAlive;
            const maxAllowed = (this.plugin.params.data.requestedMaxKeepAliveCount || 10) * 
                             (this.plugin.params.data.requestedPublishingInterval || 1000) * 1.5;
            if (timeSinceLastKeepAlive > Math.max(timeoutThreshold, maxAllowed)) {
                this.plugin.log(`No keepalive for ${timeSinceLastKeepAlive}ms, exceeding threshold ${Math.max(timeoutThreshold, maxAllowed)}ms`, 2);
                this._handleKeepAliveTimeout();
            }
        }, 5000);
    }

    _stopKeepAliveCheck() {
        if (this.keepAliveTimeout) {
            clearInterval(this.keepAliveTimeout);
            this.keepAliveTimeout = null;
        }
    }

    async _handleKeepAliveTimeout() {
        if (this.isSwitching) return;
        this.plugin.log(`Keepalive timeout detected on ${this.redundancy == 0 ? 'primary' : 'redundant'} server`, 2);
        if (this.redundancy == 0 && this.plugin.params.data.use_redundancy == 1) {
            this.isSwitching = true;
            this._stopKeepAliveCheck();
            await this.disconnect();
            this.plugin.log("Disconnected due to keepalive timeout", 2);
            if (this.onRedundancySwitch) {
                const switchSuccess = await this.onRedundancySwitch('keepalive_timeout');
                if (!switchSuccess) {
                    this.plugin.log("Failed to connect to redundant server after keepalive timeout", 2);
                    if (this.onConnectionLost) {
                        this.onConnectionLost('redundant_failed');
                    }
                }
            }
        } else {
            this.plugin.log(`Keepalive timeout on ${this.redundancy == 0 ? 'primary' : 'redundant'} server, continuing operation`, 2);
            this.lastKeepAlive = Date.now();
        }
    }

    async switchToRedundant(params, primaryCheckIntervalMs = 60000) {
        if (!this.isSwitching) return false;
        
        params.endpointUrl = params.redundancy_endpointUrl;
        this.redundancy = 1;
        
        process.send({ type: 'procinfo', data: { current_server: this.redundancy } });
        process.send({ type: 'procinfo', data: { current_endpoint: params.endpointUrl } });
        
        this.plugin.log("Switching to redundant server", 2);
        const status = await this.connect(params);
        
        if (status) {
            this._startPrimaryServerCheck(primaryCheckIntervalMs);
            this.isSwitching = false;
            return true;
        } else {
            this.isSwitching = false;
            return false;
        }
    }

    async switchToPrimary(params) {
        if (this.isSwitching) return;
        
        this.isSwitching = true;
        await this.disconnect();
        this.plugin.log("Disconnected from redundant server", 2);
        
        params.endpointUrl = params.primary_endpointUrl;
        this.redundancy = 0;
        
        process.send({ type: 'procinfo', data: { current_server: this.redundancy } });
        process.send({ type: 'procinfo', data: { current_endpoint: params.endpointUrl } });
        
        this.plugin.log("Switching back to primary server", 2);
        await this.connect(params);
        this.isSwitching = false;
    }

    _startPrimaryServerCheck(intervalMs) {
        this._stopPrimaryServerCheck();
        this.primaryCheckInterval = setInterval(async () => {
            if (this.redundancy === 1 && !this.isSwitching) {
                try {
                    const testClient = OPCUAClient.create({
                        applicationName: "IntraClientTest",
                        endpointMustExist: false,
                        clientCertificateManager: new OPCUACertificateManager({
                            automaticallyAcceptUnknownCertificate: true,
                            untrustUnknownCertificate: false
                        }),
                    });
                    await testClient.connect(this.plugin.params.data.primary_endpointUrl);
                    this.plugin.log("Primary server is available, initiating switch back", 2);
                    await testClient.disconnect();
                    this._stopPrimaryServerCheck();
                    await this.switchToPrimary(this.plugin.params.data);
                } catch (err) {
                    this.plugin.log(`Primary server still unavailable: ${util.inspect(err)}`, 2);
                }
            }
        }, intervalMs || 60000);
    }

    _stopPrimaryServerCheck() {
        if (this.primaryCheckInterval) {
            clearInterval(this.primaryCheckInterval);
            this.primaryCheckInterval = null;
        }
    }

    updateKeepAlive() {
        this.lastKeepAlive = Date.now();
    }

    getSession() {
        return this.session;
    }

    getClient() {
        return this.client;
    }

    getRedundancyState() {
        return this.redundancy;
    }

    async disconnect() {
        this._stopKeepAliveCheck();
        this._stopPrimaryServerCheck();
        
        if (this.client) {
            await this.client.disconnect();
            this.plugin.log('Client disconnected', 2);
        }
    }

    async terminate() {
        await this.disconnect();
        this.client = null;
        this.session = null;
    }

    // Callback setters
    setOnRedundancySwitch(callback) {
        this.onRedundancySwitch = callback;
    }

    setOnConnectionLost(callback) {
        this.onConnectionLost = callback;
    }

    setOnConnectionRestored(callback) {
        this.onConnectionRestored = callback;
    }
}

module.exports = ConnectionManager;