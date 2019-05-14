import StellarHDWallet from 'stellar-hd-wallet';

const VOTE_ISSUER = '';
const VOTE_CODE = 'VOTE';
const VOTE_UP_TYPE = 'UP';
const VOTE_DOWN_TYPE = 'DOWN';
const config = {};

/**
 * Must be called prior to using SDAR
 * @param {Function} findAccount Function that returns an account similar to the account json returned here:
 * https://www.stellar.org/developers/horizon/reference/endpoints/accounts-single.html
 */
function setFindAccount(findAccount) {
    config.findAccount = findAccount;
}

/**
 * Returns the vote results for an asset
 * @param assetCode
 * @param assetIssuer
 * @returns {Promise<{up: Number, down: Number}>}
 */
async function votes(assetCode, assetIssuer) {
    const results = await Promise.all([
        _votes(assetCode, assetIssuer, VOTE_UP_TYPE),
        _votes(assetCode, assetIssuer, VOTE_DOWN_TYPE)
    ]);

    return {
        up: results[0],
        down: results[1]
    };
}

/**
 * Returns the up and down voting addresses (one for each)
 * @param assetCode
 * @param assetIssuer
 * @returns {Promise<{up: Promise<*>, down: Promise<*>}>}
 */
async function votingAddresses(assetCode, assetIssuer) {
    const wallets = await Promise.all([
        hdWallet(assetCode, assetIssuer, VOTE_UP_TYPE),
        hdWallet(assetCode, assetIssuer, VOTE_DOWN_TYPE)
    ]);
    const walletUp = wallets[0];
    const walletDown = wallets[1];

    const up = _addressFromWallet(walletUp, assetCode, assetIssuer);
    const down = _addressFromWallet(walletDown, assetCode, assetIssuer);

    return {
        up,
        down
    };
}

/**
 * Determines if an address is valid for an asset. Valid does not guarantee that it is active.
 * @param address
 * @param assetCode
 * @param assetIssuer
 * @param type
 * @returns {Promise<boolean>}
 */
async function isValid(address, assetCode, assetIssuer, type) {
    const addresses = await votingAddresses(assetCode, assetIssuer, type);
    return addresses.indexOf(address) > -1;
}

/**
 * Determines if an address is active for an asset. Active does not guarantee that it is valid. To determine whether votes are valid from an address for an asset, check for active and valid true results.
 * @param account
 * @param assetCode
 * @param assetIssuer
 * @returns {boolean}
 */
function isActive(account, assetCode, assetIssuer) {
    let hasVoteTrustline = false;
    let hasAssetTrustline = false;
    account.balances.forEach(b => {
        if (b.asset_code === assetCode && b.asset_issuer === assetIssuer) {
            hasAssetTrustline = true;
            return;
        }
        if (b.asset_code === VOTE_CODE && b.asset_issuer === VOTE_ISSUER) {
            hasVoteTrustline = true;
        }
    });

    if (!hasAssetTrustline || !hasVoteTrustline) {
        return false;
    }

    if (account.signers.length !== 1 || account.signers[0].public_key !== account.account_id || account.signers[0].weight !== 0) {
        return false;
    }

    return true;
}

/**
 * Returns the set of active voting addresses for an asset.
 * @param assetCode
 * @param assetIssuer
 * @param type
 * @returns {Promise<Array>}
 */
async function activeVotingAddresses(assetCode, assetIssuer, type) {
    const wallet = await hdWallet(assetCode, assetIssuer, type);
    let lastAccountWasFunded = true;
    let index = 0;
    let addresses = [];
    while (lastAccountWasFunded) {
        const address = await wallet.getPublicKey(index);
        const account = await config.findAccount(address);
        if (isActive(account, assetCode, assetIssuer)) {
            addresses.push(address);
        }
        lastAccountWasFunded = !!account.balance;
    }

    return addresses;
}

/**
 * Returns the set of valid voting addresses for an asset (some of which may not be active)
 * @param assetCode
 * @param assetIssuer
 * @param type
 * @returns {Promise<Array>}
 */
async function validVotingAddresses(assetCode, assetIssuer, type) {
    const wallet = await hdWallet(assetCode, assetIssuer, type);
    let lastAccountWasFunded = true;
    let index = 0;
    let addresses = [];
    while (lastAccountWasFunded) {
        const address = await wallet.getPublicKey(index);
        const account = await config.findAccount(address);
        lastAccountWasFunded = !!account.balance;
    }

    return addresses;
}

/**
 * Returns the hdWallet for an asset.
 * @param assetCode
 * @param assetIssuer
 * @param type
 * @returns {Promise<*>}
 */
function hdWallet(assetCode, assetIssuer, type) {
    const rawIssuer = StrKey.decodeEd25519PublicKey(assetIssuer).toString('hex');
    const rawCode = Buffer.from(assetCode).toString('hex');
    const rawType = '0' + type;
    return new StellarHDWallet(rawIssuer + rawCode + rawType);
}

async function _votes(assetCode, assetIssuer, type) {
    const wallet = await hdWallet(assetCode, assetIssuer, type);
    let lastAccountWasFunded = true;
    let index = 0;
    let sum = 0;
    while (lastAccountWasFunded) {
        const address = await wallet.getPublicKey(index);
        const account = await config.findAccount(address);
        if (isActive(account, assetCode, assetIssuer)) {
            const voteBalance = account.balances.find(b => b.asset_code === VOTE_CODE && b.asset_issuer === VOTE_ISSUER);
            sum += voteBalance.balance;
        }
        lastAccountWasFunded = !!account.balance;
    }

    return sum;
}

async function _addressFromWallet(wallet, assetCode, assetIssuer) {
    let index = 0;
    while (true) {
        const address = await wallet.getPublicKey(index);
        const account = await config.findAccount(address);
        const active = isActive(account, assetCode, assetIssuer);
        if (active || !account.balance) {
            return {
                address,
                active
            };
        }
    }
}

export const SDAR = {
    VOTE_ISSUER,
    VOTE_CODE,
    setFindAccount,
    votes,
    votingAddresses,
    isValid,
    isActive,
    activeVotingAddresses,
    validVotingAddresses,
    hdWallet
};
