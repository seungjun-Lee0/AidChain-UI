const hre = require("hardhat");

async function main() {
  console.log("Deploying AidChain contracts...");

  // Deploy DIDRegistry first
  const DIDRegistry = await hre.ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();
  await didRegistry.deployed();
  console.log("DIDRegistry deployed to:", didRegistry.address);

  // Next, deploy AidToken with DIDRegistry address
  const [deployer] = await hre.ethers.getSigners();
  const AidToken = await hre.ethers.getContractFactory("AidToken");
  const aidToken = await AidToken.deploy(deployer.address, didRegistry.address);
  await aidToken.deployed();
  console.log("AidToken deployed to:", aidToken.address);

  // Finally, deploy AidTokenHandler with AidToken address
  const AidTokenHandler = await hre.ethers.getContractFactory("AidTokenHandler");
  const aidTokenHandler = await AidTokenHandler.deploy(aidToken.address);
  await aidTokenHandler.deployed();
  console.log("AidTokenHandler deployed to:", aidTokenHandler.address);

  console.log("All contracts deployed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 