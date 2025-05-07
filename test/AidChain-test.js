const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AidChain Contracts", function () {
  let didRegistry;
  let aidToken;
  let aidTokenHandler;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addr4;
  let addr5;
  let addr6;

  beforeEach(async function () {
    // Get signers for testing
    [owner, addr1, addr2, addr3, addr4, addr5, addr6] = await ethers.getSigners();
    
    // Deploy DIDRegistry
    const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
    didRegistry = await DIDRegistry.deploy();
    await didRegistry.deployed();
    
    // Deploy AidToken with DIDRegistry address
    const AidToken = await ethers.getContractFactory("AidToken");
    aidToken = await AidToken.deploy(owner.address, didRegistry.address);
    await aidToken.deployed();
    
    // Deploy AidTokenHandler with AidToken address
    const AidTokenHandler = await ethers.getContractFactory("AidTokenHandler");
    aidTokenHandler = await AidTokenHandler.deploy(aidToken.address);
    await aidTokenHandler.deployed();
  });

  describe("DIDRegistry", function () {
    it("Should register a transporter correctly", async function () {
      await didRegistry.registerTransporterDID(addr1.address, "FIJI");
      expect(await didRegistry.getRole(addr1.address)).to.equal(1); // 1 = Transporter role
      expect(await didRegistry.getLocation(addr1.address)).to.equal("FIJI");
    });
    
    it("Should register a ground relief correctly", async function () {
      await didRegistry.registerGroundReliefDID(addr2.address, "FIJI");
      expect(await didRegistry.getRole(addr2.address)).to.equal(2); // 2 = GroundRelief role
    });
    
    it("Should register a recipient correctly", async function () {
      await didRegistry.registerRecipientDID(addr3.address, "FIJI");
      expect(await didRegistry.getRole(addr3.address)).to.equal(3); // 3 = Recipient role
    });

    it("Should return empty arrays when no users are registered", async function () {
      expect(await didRegistry.getAllTransporters()).to.be.an('array').that.is.empty;
      expect(await didRegistry.getAllGroundRelief()).to.be.an('array').that.is.empty;
      expect(await didRegistry.getAllRecipients()).to.be.an('array').that.is.empty;
    });

    it("Should correctly add and retrieve multiple registered users", async function () {
      // Register multiple users of each type
      await didRegistry.registerTransporterDID(addr1.address, "FIJI");
      await didRegistry.registerTransporterDID(addr4.address, "PNG");
      
      await didRegistry.registerGroundReliefDID(addr2.address, "FIJI");
      await didRegistry.registerGroundReliefDID(addr5.address, "SAMOA");
      
      await didRegistry.registerRecipientDID(addr3.address, "FIJI");
      await didRegistry.registerRecipientDID(addr6.address, "VANUATU");
      
      // Check getAllTransporters
      const transporters = await didRegistry.getAllTransporters();
      expect(transporters).to.have.lengthOf(2);
      expect(transporters).to.include(addr1.address);
      expect(transporters).to.include(addr4.address);
      
      // Check getAllGroundRelief
      const groundRelief = await didRegistry.getAllGroundRelief();
      expect(groundRelief).to.have.lengthOf(2);
      expect(groundRelief).to.include(addr2.address);
      expect(groundRelief).to.include(addr5.address);
      
      // Check getAllRecipients
      const recipients = await didRegistry.getAllRecipients();
      expect(recipients).to.have.lengthOf(2);
      expect(recipients).to.include(addr3.address);
      expect(recipients).to.include(addr6.address);
    });

    it("Should not allow non-owner to register users", async function () {
      // Try to register as non-owner
      await expect(
        didRegistry.connect(addr1).registerTransporterDID(addr1.address, "FIJI")
      ).to.be.reverted;
      
      await expect(
        didRegistry.connect(addr1).registerGroundReliefDID(addr2.address, "FIJI")
      ).to.be.reverted;
      
      await expect(
        didRegistry.connect(addr1).registerRecipientDID(addr3.address, "FIJI")
      ).to.be.reverted;
    });
  });

  describe("AidToken", function () {
    it("Should accept donations and issue tokens when threshold is met", async function () {
      // Send a donation that exceeds the threshold
      const donationAmount = ethers.utils.parseEther("0.4"); // Above threshold of 0.32 ETH
      await aidToken.connect(addr1).donate({ value: donationAmount });
      
      // Check if token is issued
      expect(await aidToken.tokenIdCounter()).to.equal(1);
      expect(await aidToken.isTokenIssued(0)).to.equal(true);
    });

    it("Should track donor balances correctly", async function () {
      const donationAmount1 = ethers.utils.parseEther("0.2");
      const donationAmount2 = ethers.utils.parseEther("0.1");
      
      // Donate from addr1
      await aidToken.connect(addr1).donate({ value: donationAmount1 });
      expect(await aidToken.donorBalances(addr1.address)).to.equal(donationAmount1);
      
      // Donate again from addr1
      await aidToken.connect(addr1).donate({ value: donationAmount2 });
      expect(await aidToken.donorBalances(addr1.address)).to.equal(
        donationAmount1.add(donationAmount2)
      );
      
      // Donate from addr2
      await aidToken.connect(addr2).donate({ value: donationAmount2 });
      expect(await aidToken.donorBalances(addr2.address)).to.equal(donationAmount2);
    });

    it("Should track current token balance correctly", async function () {
      const donationAmount = ethers.utils.parseEther("0.2"); // Below threshold
      
      // Initial balance should be zero
      expect(await aidToken.currentTokenBalance()).to.equal(0);
      
      // After donation
      await aidToken.connect(addr1).donate({ value: donationAmount });
      expect(await aidToken.currentTokenBalance()).to.equal(donationAmount);
    });

    it("Should reject donations below minimum", async function () {
      const minDonation = await aidToken.minDonation();
      const lowDonation = minDonation.sub(1); // 1 wei below minimum
      
      await expect(
        aidToken.connect(addr1).donate({ value: lowDonation })
      ).to.be.revertedWith("Donation amount must be at least the minimum");
    });

    it("Should emit AidTokenIssued event when threshold is met", async function () {
      const donationAmount = ethers.utils.parseEther("0.4"); // Above threshold
      
      await expect(aidToken.connect(addr1).donate({ value: donationAmount }))
        .to.emit(aidToken, "AidTokenIssued")
        .withArgs(0, [addr1.address]); // First token ID is 0
    });

    it("Should only allow relief agency to assign recipients", async function () {
      // Create a token first
      const donationAmount = ethers.utils.parseEther("0.4");
      await aidToken.connect(addr1).donate({ value: donationAmount });
      
      // Register necessary roles
      await didRegistry.registerTransporterDID(addr1.address, "FIJI");
      await didRegistry.registerGroundReliefDID(addr2.address, "FIJI");
      await didRegistry.registerRecipientDID(addr3.address, "FIJI");
      
      // Non-relief agency trying to assign (should fail)
      await expect(
        aidToken.connect(addr1).assignAidRecipients(
          0,
          addr1.address,
          addr2.address,
          addr3.address,
          "FIJI"
        )
      ).to.be.revertedWith("Only relief agency can assign recipients");
      
      // Relief agency assigning (should succeed)
      await expect(
        aidToken.connect(owner).assignAidRecipients(
          0,
          addr1.address,
          addr2.address,
          addr3.address,
          "FIJI"
        )
      ).to.not.be.reverted;
    });

    it("Should validate roles when assigning recipients", async function () {
      // Create a token first
      const donationAmount = ethers.utils.parseEther("0.4");
      await aidToken.connect(addr1).donate({ value: donationAmount });
      
      // Only register some roles (missing recipient)
      await didRegistry.registerTransporterDID(addr1.address, "FIJI");
      await didRegistry.registerGroundReliefDID(addr2.address, "FIJI");
      // addr3 not registered as recipient
      
      // Should fail due to missing recipient role
      await expect(
        aidToken.connect(owner).assignAidRecipients(
          0,
          addr1.address,
          addr2.address,
          addr3.address,
          "FIJI"
        )
      ).to.be.revertedWith("Recipient address must have recipient role");
    });
  });

  describe("AidTokenHandler", function () {
    beforeEach(async function () {
      // Setup a token with assigned recipients for testing
      const donationAmount = ethers.utils.parseEther("0.4");
      await aidToken.connect(addr1).donate({ value: donationAmount });
      
      // Register roles
      await didRegistry.registerTransporterDID(addr1.address, "FIJI");
      await didRegistry.registerGroundReliefDID(addr2.address, "FIJI");
      await didRegistry.registerRecipientDID(addr3.address, "FIJI");
      
      // Assign recipients to token
      await aidToken.connect(owner).assignAidRecipients(
        0,
        addr1.address,
        addr2.address,
        addr3.address,
        "FIJI"
      );
    });

    it("Should start with Issued status", async function () {
      expect(await aidTokenHandler.aidStatus(0)).to.equal(0); // 0 = Issued
      expect(await aidTokenHandler.getAidStatusString(0)).to.equal("Issued");
    });

    it("Should allow transporter to mark as InTransit", async function () {
      await aidTokenHandler.connect(addr1).authenticateTransferTeam(0);
      expect(await aidTokenHandler.aidStatus(0)).to.equal(1); // 1 = InTransit
      expect(await aidTokenHandler.getAidStatusString(0)).to.equal("InTransit");
    });

    it("Should not allow non-transporter to mark as InTransit", async function () {
      await expect(
        aidTokenHandler.connect(addr2).authenticateTransferTeam(0)
      ).to.be.revertedWith("Only assigned transfer team can authenticate");
    });

    it("Should allow ground relief to mark as Delivered", async function () {
      // First mark as InTransit
      await aidTokenHandler.connect(addr1).authenticateTransferTeam(0);
      
      // Then mark as Delivered
      await aidTokenHandler.connect(addr2).authenticateGroundRelief(0);
      expect(await aidTokenHandler.aidStatus(0)).to.equal(2); // 2 = Delivered
      expect(await aidTokenHandler.getAidStatusString(0)).to.equal("Delivered");
    });

    it("Should not allow ground relief to mark as Delivered before InTransit", async function () {
      await expect(
        aidTokenHandler.connect(addr2).authenticateGroundRelief(0)
      ).to.be.revertedWith("Aid must be in transit first");
    });

    it("Should allow recipient to claim aid", async function () {
      // First mark as InTransit
      await aidTokenHandler.connect(addr1).authenticateTransferTeam(0);
      
      // Then mark as Delivered
      await aidTokenHandler.connect(addr2).authenticateGroundRelief(0);
      
      // Finally claim aid
      await aidTokenHandler.connect(addr3).claimAid(0);
      expect(await aidTokenHandler.aidStatus(0)).to.equal(3); // 3 = Claimed
      expect(await aidTokenHandler.getAidStatusString(0)).to.equal("Claimed");
    });

    it("Should not allow recipient to claim aid before Delivered", async function () {
      // Mark as InTransit
      await aidTokenHandler.connect(addr1).authenticateTransferTeam(0);
      
      // Try to claim before Delivered
      await expect(
        aidTokenHandler.connect(addr3).claimAid(0)
      ).to.be.revertedWith("Aid must be delivered first");
    });

    it("Should emit AidTransferred event on status change", async function () {
      // Check event when marking as InTransit
      await expect(aidTokenHandler.connect(addr1).authenticateTransferTeam(0))
        .to.emit(aidTokenHandler, "AidTransferred")
        .withArgs(0, addr1.address, 1); // tokenId, actor, new status
      
      // Check event when marking as Delivered
      await expect(aidTokenHandler.connect(addr2).authenticateGroundRelief(0))
        .to.emit(aidTokenHandler, "AidTransferred")
        .withArgs(0, addr2.address, 2);
      
      // Check event when marking as Claimed
      await expect(aidTokenHandler.connect(addr3).claimAid(0))
        .to.emit(aidTokenHandler, "AidTransferred")
        .withArgs(0, addr3.address, 3);
    });

    it("Should not allow re-claiming of already claimed aid", async function () {
      // Progress through full workflow
      await aidTokenHandler.connect(addr1).authenticateTransferTeam(0);
      await aidTokenHandler.connect(addr2).authenticateGroundRelief(0);
      await aidTokenHandler.connect(addr3).claimAid(0);
      
      // Try to claim again
      await expect(
        aidTokenHandler.connect(addr3).claimAid(0)
      ).to.be.revertedWith("Aid has already been claimed");
    });
  });

  describe("End-to-end workflow", function () {
    it("Should handle the complete aid distribution workflow", async function () {
      // 1. Register stakeholders
      await didRegistry.registerTransporterDID(addr1.address, "FIJI");
      await didRegistry.registerGroundReliefDID(addr2.address, "FIJI");
      await didRegistry.registerRecipientDID(addr3.address, "FIJI");
      
      // 2. Make donations and issue token
      const donationAmount1 = ethers.utils.parseEther("0.2");
      const donationAmount2 = ethers.utils.parseEther("0.2");
      await aidToken.connect(addr4).donate({ value: donationAmount1 });
      await aidToken.connect(addr5).donate({ value: donationAmount2 });
      
      // Check token issuance
      expect(await aidToken.tokenIdCounter()).to.equal(1);
      expect(await aidToken.isTokenIssued(0)).to.equal(true);
      expect(await aidToken.currentTokenBalance()).to.equal(0); // Reset after token issuance
      
      // 3. Relief agency assigns recipients
      await aidToken.connect(owner).assignAidRecipients(
        0,
        addr1.address,
        addr2.address,
        addr3.address,
        "FIJI"
      );
      
      // Check assignments
      expect(await aidToken.getTransferTeam(0)).to.equal(addr1.address);
      expect(await aidToken.getGroundRelief(0)).to.equal(addr2.address);
      expect(await aidToken.getRecipient(0)).to.equal(addr3.address);
      
      // 4. Check initial status
      expect(await aidTokenHandler.aidStatus(0)).to.equal(0); // Issued
      
      // 5. Update status through the chain
      await aidTokenHandler.connect(addr1).authenticateTransferTeam(0);
      expect(await aidTokenHandler.aidStatus(0)).to.equal(1); // InTransit
      
      await aidTokenHandler.connect(addr2).authenticateGroundRelief(0);
      expect(await aidTokenHandler.aidStatus(0)).to.equal(2); // Delivered
      
      await aidTokenHandler.connect(addr3).claimAid(0);
      expect(await aidTokenHandler.aidStatus(0)).to.equal(3); // Claimed
      
      // 6. Make more donations for a second token
      const donationAmount3 = ethers.utils.parseEther("0.4");
      await aidToken.connect(addr6).donate({ value: donationAmount3 });
      
      // Check second token
      expect(await aidToken.tokenIdCounter()).to.equal(2);
      expect(await aidToken.isTokenIssued(1)).to.equal(true);
    });
  });
});