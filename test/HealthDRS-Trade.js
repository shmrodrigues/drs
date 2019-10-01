
const BigNumber = web3.BigNumber
const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

var HealthCashMock = artifacts.require('./helpers/HealthCashMock.sol');  
var HealthDRS = artifacts.require("./HealthDRS.sol")
var isAddress = require('./helpers/isAddress')

contract('HealthDRS :: Trade', function(accounts) {

  beforeEach(async function() {
    // this.token = await HealthCashMock.new()
    this.drs = await HealthDRS.new()
    this.url = 'https://blogs.scientificamerican.com/observations/consciousness-goes-deeper-than-you-think/'    
    let tx = await this.drs.createService(this.url)
    this.service = tx.logs[0].args._service      
  })
  
  it('key owners should be able to trade keys enabled for trade', async function() {

    let tx1 = await this.drs.createKey(this.service)
    let key1 = tx1.logs[0].args._key
    await this.drs.setKeyPermissions(key1, false, true, false); 

    let tx2 = await this.drs.issueKey(this.service,accounts[1])
    let key2 = tx2.logs[0].args._key
    await this.drs.setKeyPermissions(key2, false, true, false);     

    let owner = await this.drs.isKeyOwner(key2,accounts[1])
    owner.should.equal(true)  
    owner = await this.drs.isKeyOwner(key1,accounts[0])
    owner.should.equal(true)  
          
    await this.drs.createTradeOffer(key2, key1, {from: accounts[1]})
    await this.drs.tradeKey(key1, key2)

    owner = await this.drs.isKeyOwner(key2,accounts[0])
    owner.should.equal(true) 

    owner = await this.drs.isKeyOwner(key1,accounts[1])
    owner.should.equal(true)
  })

  /**
   * Error: Returned error: VM Exception while processing transaction: revert canTrade() owners[key].length error -- Reason given: canTrade() owners[key].length error.
   */
  it('key owners should not be able to trade shared keys enabled for trade', async function () {

    let tx1 = await this.drs.createKey(this.service)
    let key1 = tx1.logs[0].args._key
    await this.drs.setKeyPermissions(key1, true, true, false);
    await this.drs.shareKey(key1, accounts[1])

    let tx2 = await this.drs.issueKey(this.service, accounts[1])
    let key2 = tx2.logs[0].args._key
    await this.drs.setKeyPermissions(key2, false, true, false);

    let owner = await this.drs.isKeyOwner(key2, accounts[1])
    owner.should.equal(true)
    owner = await this.drs.isKeyOwner(key1, accounts[0])
    owner.should.equal(true)

    await this.drs.createTradeOffer(key2, key1, { from: accounts[1] })
    await this.drs.tradeKey(key1, key2)

    owner = await this.drs.isKeyOwner(key2, accounts[0])
    owner.should.equal(false)

    await this.drs.unshareKey(key1, accounts[1])
    owner = await this.drs.isKeyOwner(key1, accounts[1])
    owner.should.equal(false)
  })

  /**
   * Error: Returned error: VM Exception while processing transaction: revert canTrade() keys[key].canTrade error -- Reason given: canTrade() keys[key].canTrade error.
   */
  it('key owners should not be able to trade keys not enabled for trade', async function () {


    let tx = await this.drs.createKey(this.service)
    let key1 = tx.logs[0].args._key

    let tx2 = await this.drs.issueKey(this.service, accounts[1])
    let key2 = tx2.logs[0].args._key

    let owner = await this.drs.isKeyOwner(key1, accounts[0])
    owner.should.equal(true)

    await this.drs.createTradeOffer(key2, key1, { from: accounts[1] })
    await this.drs.tradeKey(key1, key2)

    owner = await this.drs.isKeyOwner(key2, accounts[0])
    owner.should.equal(false)

    owner = await this.drs.isKeyOwner(key1, accounts[1])
    owner.should.equal(false)

    //enable keys for trade
    await this.drs.setKeyPermissions(key2, false, true, true)
    await this.drs.setKeyPermissions(key1, false, true, true)

    await this.drs.createTradeOffer(key2, key1, { from: accounts[1] })
    await this.drs.tradeKey(key1, key2)

    owner = await this.drs.isKeyOwner(key2, accounts[0])
    owner.should.equal(true)

    owner = await this.drs.isKeyOwner(key1, accounts[1])
    owner.should.equal(true)

  })

  /**
   * Error: Returned error: VM Exception while processing transaction: revert tradeKey() error -- Reason given: tradeKey() error.
   */
  it('non-owners should not be able to trade keys', async function () {
    let tx = await this.drs.createKey(this.service)
    let key1 = tx.logs[0].args._key

    tx = await this.drs.createService('newurl', { from: accounts[1] })
    let service = tx.logs[0].args._service
    let tx2 = await this.drs.createKey(service, { from: accounts[1] })
    let key2 = tx2.logs[0].args._key

    //enable keys for trade
    await this.drs.setKeyPermissions(key2, false, true, true, { from: accounts[1] })
    await this.drs.setKeyPermissions(key1, false, true, true)

    let owner = await this.drs.isKeyOwner(key2, accounts[1])
    owner.should.equal(true)

    await this.drs.tradeKey(key2, key1, { from: accounts[1] })
    //trying to trade a key we don't own
    await this.drs.tradeKey(key1, key2, { from: accounts[1] })

    owner = await this.drs.isKeyOwner(key2, accounts[0])
    owner.should.not.equal(true)

    owner = await this.drs.isKeyOwner(key1, accounts[1])
    owner.should.not.equal(true)
  })

  /**
   * Error: Returned error: VM Exception while processing transaction: revert canSell() key can't be sold error -- Reason given: canSell() key can't be sold error.
   */
  it('creating a trade offer should negate an active sales offer', async function () {
    let tx0 = await this.drs.createKey(this.service)
    let key0 = tx0.logs[0].args._key

    await this.drs.createSalesOffer(key0, accounts[1], 5, true)
    await this.drs.tradeKey(key0, key0)

    //inspect sales offer
    let so = await this.drs.salesOffers(key0)
    so[0].should.equal('0x0000000000000000000000000000000000000000')
    so[1].should.be.bignumber.equal(0)
  })
})
