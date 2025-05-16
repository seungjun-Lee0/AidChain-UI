const hre = require("hardhat");

async function main() {
  console.log("Deploying AidChain contracts...");

  // Get the deployer account and a separate relief agency account
  const [deployer, reliefAgency] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Relief Agency address:", reliefAgency.address);

  // Deploy DIDRegistry with relief agency address
  const DIDRegistry = await hre.ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy(reliefAgency.address);
  await didRegistry.deployed();
  console.log("DIDRegistry deployed to:", didRegistry.address);

  // Next, deploy AidToken with relief agency address and DIDRegistry address
  const AidToken = await hre.ethers.getContractFactory("AidToken");
  const aidToken = await AidToken.deploy(reliefAgency.address, didRegistry.address);
  await aidToken.deployed();
  console.log("AidToken deployed to:", aidToken.address);

  // Finally, deploy AidTokenHandler with AidToken address
  const AidTokenHandler = await hre.ethers.getContractFactory("AidTokenHandler");
  const aidTokenHandler = await AidTokenHandler.deploy(aidToken.address);
  await aidTokenHandler.deployed();
  console.log("AidTokenHandler deployed to:", aidTokenHandler.address);

  console.log("All contracts deployed successfully!");
  console.log({
    DIDRegistry: didRegistry.address,
    AidToken: aidToken.address,
    AidTokenHandler: aidTokenHandler.address,
    ReliefAgency: reliefAgency.address
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 