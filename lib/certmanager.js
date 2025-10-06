/**
 * certmanager.js
 * 
 */

// const util = require('util');
const fs = require("fs").promises;
const path = require("path");
const os = require("os");


const { OPCUACertificateManager } = require('node-opcua');


module.exports = {
    async start(plugin, pluginbasepath) {
        this.plugin = plugin;
        const params = plugin.params;

        // const clientPKIDir = path.join(__dirname, 'pki');
        const clientPKIDir = path.join(pluginbasepath, 'pki');
        const certificateFile = path.join(clientPKIDir, 'own/certs/certificate.pem');
        const certificateDerFile = path.join(clientPKIDir, 'own/certs/certificate.der');
        const privateKeyFile = path.join(clientPKIDir, "own/private/private_key.pem");
        // Проверка и создание директории PKI
        if (!(await fs.access(clientPKIDir).catch(() => false))) {
            await fs.mkdir(clientPKIDir, { recursive: true });
        }
        const certExists = await fs
            .access(certificateFile)
            .then(() => true)
            .catch(() => false);

        this.clientCM = new OPCUACertificateManager({
            name: 'ClientCertificateManager',
            rootFolder: clientPKIDir,
            automaticallyAcceptUnknownCertificate: params.trust_cert == 1 // Для продакшена установить false
        });

        await this.clientCM.initialize();
        if (!certExists) {
            await this.createCert(certificateFile, certificateDerFile);
        }
        return {clientCM: this.clientCM, privateKeyFile, certificateDerFile, certificateFile};
    },

    async createCert(certificateFile, certificateDerFile) {

        const hostname = os.hostname();
        const ipAddresses = getIpAddresses();
        const certFileRequest = {
            applicationUri: `urn:${hostname}:NodeOPCUA-Client`,
            dns: [hostname],
            ip: ipAddresses, // Используем массив IP-адресов
            outputFile: certificateFile,
            subject: {
                commonName: 'Intra',
                organization: 'Intra',
                country: 'RU',
                locality: 'Cheboksary'
            },
            startDate: new Date(Date.now()),
            validity: 360
        };
        await this.clientCM.createSelfSignedCertificate(certFileRequest);
        const pemContent = await fs.readFile(certificateFile, "utf8");
        const base64Cert = pemContent
            .replace(/-----BEGIN CERTIFICATE-----/g, "")
            .replace(/-----END CERTIFICATE-----/g, "")
            .replace(/\r?\n|\r/g, "")
            .trim();
        const derBuffer = Buffer.from(base64Cert, "base64");
        await fs.mkdir(path.dirname(certificateDerFile), { recursive: true });
        await fs.writeFile(certificateDerFile, derBuffer);
    }
};

function getIpAddresses() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (let iface of Object.values(interfaces)) {
        for (let alias of iface) {
            if (alias.family === "IPv4" && !alias.internal) {
                ips.push(alias.address);
            }
        }
    }
    return ips;
}
