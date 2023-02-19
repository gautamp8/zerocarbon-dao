import {
  useSDK,
  useAddress,
  useNetwork,
  useContract,
  ConnectWallet,
  Web3Button,
  useNFTBalance,
} from '@thirdweb-dev/react';
import { 
  Button,
  Box,
  Flex,
  Text,
  Badge,
  CircularProgress, 
  Tr
} from "@chakra-ui/react";
import { PieChart } from 'react-minimal-pie-chart';
import { ChainId } from '@thirdweb-dev/sdk';
import { useState, useEffect, useMemo } from 'react';
import { AddressZero } from '@ethersproject/constants';
import { calculateEmissions } from './emissions';
import contractABI from './data/contractABI.json';
import { ethers } from "ethers";

const App = () => {
  // Use the hooks thirdweb give us.
  const address = useAddress();
  const network = useNetwork();
  // The SDK
  // const eth = window.ethereum;

  console.log('👋 Address:', address);
  // Initialize our Edition Drop contract
  const editionDropAddress = '0x4989dC26bA459f89E21A86e75Cc9b9bE2eFB8FD4';
  const ETHERSCAN_API_KEY = 'W43BF6PWCKDTI6D2BNGUYYGAQYRVUZSJIV';
  const CARBON_INDEX_CONTRACT = "0x976c0C8B5Cd37066720c479E030e39aC83104f66";
  const PREMINE_API_ENDPOINT = "https://a6ef-2401-4900-1cb8-ea12-199a-c45a-4916-8a02.ngrok.io/premine"
  const TREASURY_API_ENDPOINT = new URL("https://a6ef-2401-4900-1cb8-ea12-199a-c45a-4916-8a02.ngrok.io/treasury")

  // A Web3Provider wraps a standard Web3 provider, which is
  // what MetaMask injects as window.ethereum into each page
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const carbonIndexContract = new ethers.Contract(CARBON_INDEX_CONTRACT, contractABI, provider);

  const { contract: editionDrop } = useContract(
    editionDropAddress,
    'edition-drop',
  );
  // Initialize our token contract
  const { contract: token } = useContract(
    '0x5C552F653DD722CFab711F01dc2Edc5b155E6207',
    'token',
  );
  const { contract: vote } = useContract(
    '0x1789eafF779234063ED2883Bb82c3049903E5F10',
    'vote',
  );
  // Hook to check if the user has our NFT
  const { data: nftBalance } = useNFTBalance(editionDrop, address, '0');

  const hasClaimedNFT = useMemo(() => {
    return nftBalance && nftBalance.gt(0);
  }, [nftBalance]);

  // Holds the amount of token each member has in state.
  const [memberTokenAmounts, setMemberTokenAmounts] = useState([]);
  // The array holding all of our members addresses.
  const [memberAddresses, setMemberAddresses] = useState([]);
  // Treasury State
  const [treasuryData, setTreasuryData] = useState({
    "chainId": 0,
    "treasury_holdings": [
      {
        "symbol": "BCT",
        "address": "0x785534e1AbB988aCEAE9A1a7FC81211Ab7C73eF1",
        "balance": "101665021500000000001",
        "pct": "30.0",
        "price": "1.46"
      },
      {
        "symbol": "NCT",
        "address": "0x80a533187B2364054cb62475f3d8BC973d7BC443",
        "balance": "135553362000000000001",
        "pct": "40.0",
        "price": "1.92"
      },
      {
        "symbol": "MCO2",
        "address": "0x7Dd70013C60724D31E6c59b07988A58b10e9370f",
        "balance": "101665021500000000001",
        "pct": "30.0",
        "price": "1.9"
      }
    ],
    "totalMinted": 2,
    "carbonOffseted": "156.8 Tonne",
    "indexPrice": "1.01",
    "token_holders": [
      {
        address: "0x0Faef5cB418d2997Ba22e0f06059f9a4071bc2d7",
        balance: "500.01"
      },
      {
        address: "0x750AF4B3125f6F6A176581a446de11987EbAc2E3", 
        balance: "435.67"
      }
    ]
  });
  // The object holding emissions
  const [emissions, setEmissions] = useState({});
  const [signer, setSigner] = useState({});
  const [nftMetadata, setNftMetadata] = useState({});

  // A fancy function to shorten someones wallet address, no need to show the whole thing.
  const shortenAddress = (str) => {
    return str.substring(0, 10) + '...' + str.substring(str.length - 4);
  };

  function RenderAddress(address) {
    return <div className="badge"> <b> Connected Address: {shortenAddress(address)} </b></div>
  }

  // Function to calculate emissions for given wallet
  const handleEmissionsCalculation = async () => {
    setIsLoading(true);
    const result = await calculateEmissions({
      address: "0xddeBcc9A3E5D9f315d6d440EEcd863C4D6941184",
      etherscanAPIKey: ETHERSCAN_API_KEY
    });
    setEmissionsCalculated(true);
    setEmissions(result);
    setIsLoading(false);
  };

  // Amount Investment and offsetting related functions
  const getNFTMetadata = async () => {
    const request = {
      method: 'POST',
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({
        ...emissions,
        address: address,
        network: network?.[0].data.chain.id,
      }),
    };
    console.log("Request body", JSON.stringify(request));
    const response = await fetch(`${PREMINE_API_ENDPOINT}`, request);
    return response.json();
  };

  // Amount Investment and offsetting related functions
  const getTreasuryData = async () => {
    const params = {chainId: network?.[0].data.chain.id}
    TREASURY_API_ENDPOINT.search = new URLSearchParams(params).toString();
    const response = await fetch(TREASURY_API_ENDPOINT);
    return response.json();
  };

  const offsetEmissions = async () => {
    // const invest_data = await getAmountToInvest()
    setIsLoading(true);
    setNFTMinted(false);

    const nft_metadata = await getNFTMetadata();
    setNftMetadata(nft_metadata)
    await transferTokens(nft_metadata.nativeValue, nft_metadata.ciValue);
    
    setNFTMinted(true);
    setNFTViewed(false);
  }

  async function transferTokens(nativeValue, ciValue) {
    console.log("Signer", signer)
    const carbonIndexSigner = carbonIndexContract.connect(signer);
    const amountN = ethers.utils.parseUnits(nativeValue, 18);
    const amountC = ethers.utils.parseUnits(ciValue, 18);
    const transaction = await carbonIndexSigner.investv1(amountC, {"value": amountN});
    const txn_receipt = await transaction.wait();
    // console.log(JSON.stringify(transaction));
    console.log("Transaction receipt - " + JSON.stringify(txn_receipt));
  }

  async function navigateToDAO() {
    setNFTViewed(true);
  }

  // State management stuff
  const [proposals, setProposals] = useState([]);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isEmissionsCalculated, setEmissionsCalculated] = useState(false);
  const [isNFTMinted, setNFTMinted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isNFTViewed, setNFTViewed] = useState(false);

  // Retrieve all our existing proposals from the contract.
  useEffect(() => {
    console.log("Calling useEffect Ether");
    provider.send("eth_requestAccounts", []).then(() => setSigner(provider.getSigner()));
    if (!isNFTMinted) {
      return;
    }

    // A simple call to vote.getAll() to grab the proposals.
    const getAllProposals = async () => {
      try {
        const proposals = await vote.getAll();
        setProposals(proposals);
        console.log('🌈 Proposals:', proposals);
      } catch (error) {
        console.log('failed to get proposals', error);
      }
    };
    getAllProposals();
  }, [isNFTMinted, vote]);

  // We also need to check if the user already voted.
  useEffect(() => {
    if (!isNFTMinted) {
      return;
    }

    // If we haven't finished retrieving the proposals from the useEffect above
    // then we can't check if the user voted yet!
    if (!proposals.length) {
      return;
    }

    const checkIfUserHasVoted = async () => {
      try {
        const hasVoted = await vote.hasVoted(proposals[0].proposalId, address);
        setHasVoted(hasVoted);
        if (hasVoted) {
          console.log('🥵 User has already voted');
        } else {
          console.log('🙂 User has not voted yet');
        }
      } catch (error) {
        console.error('Failed to check if wallet has voted', error);
      }
    };
    checkIfUserHasVoted();
  }, [isNFTMinted, proposals, address, vote]);

  // This useEffect grabs all the addresses of our members holding our NFT.
  useEffect(() => {
    // if (!isNFTMinted) {
    //   return;
    // }
    console.log("USE EFFECT TO GET TREASURY");
    
    const getAllTreasury = async () => {
      try {
        const treasuryData = await getTreasuryData();
        console.log("TREASURY DATA DATA DATA", treasuryData);
        setTreasuryData(treasuryData);
        console.log('🚀 Treasury Data ', JSON.stringify(treasuryData));
      } catch (error) {
        console.error('failed to get treasury', error);
      }
    };
    getAllTreasury();
  }, [isNFTMinted]);

  // This useEffect grabs the # of token each member holds.
  // useEffect(() => {
  //   if (!isNFTMinted) {
  //     return;
  //   }

  //   const getAllBalances = async () => {
  //     try {
  //       const amounts = await token?.history.getAllHolderBalances();
  //       setMemberTokenAmounts(amounts);
  //       console.log('👜 Amounts', amounts);
  //     } catch (error) {
  //       console.error('failed to get member balances', error);
  //     }
  //   };
  //   getAllBalances();
  // }, [isNFTMinted, token?.history]);

  // Now, we combine the memberAddresses and memberTokenAmounts into a single array
  // const memberList = useMemo(() => {
  //   return memberAddresses.map((address) => {
  //     // We're checking if we are finding the address in the memberTokenAmounts array.
  //     // If we are, we'll return the amount of token the user has.
  //     // Otherwise, return 0.
  //     const member = memberTokenAmounts?.find(
  //       ({ holder }) => holder === address,
  //     );

  //     return {
  //       address,
  //       tokenAmount: member?.balance.displayValue || '0',
  //     };
  //   });
  // }, [memberAddresses, memberTokenAmounts]);

  if (address && network?.[0].data.chain.id !== ChainId.Mumbai) {
    return (
      <div className="unsupported-network">
        <h2>Please connect to MATIC Mumbai Testnet</h2>
        <p>
          This dapp only works on the MATIC network, please switch networks in
          your connected wallet.
        </p>
      </div>
    );
  }


  // This is the case where the user hasn't connected their wallet
  // to your web app. Let them call connectWallet.
  if (!address) {
    return (
      <div className="landing">
        <h1>ZeroCarb🌍n DAO</h1>
        <h2> Connect your wallet to calculate your emissions </h2>
        <br></br>
        <div className="btn-hero">
          <ConnectWallet/>
        </div>
      </div>
    );
  }

  // calculate emissions after getting the address
  if (address && !isEmissionsCalculated) {
    return (
      <div className='landing'>
        <h1>ZeroCarb🌍n DAO</h1>
        <h2>Calculate your historical and current emissions 📈</h2>
        <br></br>
        {RenderAddress(address)}
        <br></br>
        <div>
          <Button
            onClick={handleEmissionsCalculation}
            isLoading={isLoading}
            bg="blue.800"
            color="blue.300"
            fontSize="lg"
            fontWeight="medium"
            borderRadius="xl"
            border="1px solid transparent"
            _hover={{
              borderColor: "blue.700",
              color: "blue.400",
            }}
            _active={{
              backgroundColor: "blue.800",
              borderColor: "blue.700",
            }}
          >
            {isLoading ? <CircularProgress isIndeterminate size="24px" color="teal.500" /> : "Calculate Emissions"}
          </Button>
        </div>
      </div>
    )
  }
  
  // Emissions are calculated and we need to display the values and allow users to offset
  if (isEmissionsCalculated && emissions && !isNFTViewed) {
    return !isNFTMinted ? (
      <div className="landing">
        <h1>Emissions Stats📊</h1>
        <br></br>
        {RenderAddress(address)}
        <br></br>
        <div >
          <br></br>
          <Box>
            {DisplayData(emissions)}
          </Box>
          <br></br>
          <Button
            onClick={offsetEmissions}
            isLoading={isLoading}
            bg="blue.800"
            color="blue.300"
            fontSize="lg"
            fontWeight="medium"
            borderRadius="xl"
            border="1px solid transparent"
            _hover={{
              borderColor: "blue.700",
              color: "blue.400",
            }}
            _active={{
              backgroundColor: "blue.800",
              borderColor: "blue.700",
            }}
          >
            {isLoading ? <CircularProgress isIndeterminate size="24px" color="teal.500" /> : "Offset Emissions"}
          </Button>
        </div>
      </div>
    ) :
       (
        <div className="landing">
          <h1>Your NFT is here!</h1>
          <br></br>
          {RenderAddress(address)}
          <br></br>
          <div >
            <br></br>
            <Box>
              <a href={nftMetadata.openseaUrl} target="_blank"> <h2> View on OpenSea </h2> </a>
            </Box>
            <br></br>
            <Button
              onClick={navigateToDAO}
              bg="blue.800"
              color="blue.300"
              fontSize="lg"
              fontWeight="medium"
              borderRadius="xl"
              border="1px solid transparent"
              _hover={{
                borderColor: "blue.700",
                color: "blue.400",
              }}
              _active={{
                backgroundColor: "blue.800",
                borderColor: "blue.700",
              }}
            >
              ZeroCarb🌍n Dashboard
            </Button>
          </div>
        </div>
      )
  }


  if (isNFTViewed && treasuryData) {
    const bct = treasuryData.treasury_holdings[0]
    const nct = treasuryData.treasury_holdings[1]
    const mco2 = treasuryData.treasury_holdings[2]
    return (
      <div className="member-page">
        <h1>ZeroCarb🌍n Dashboard</h1>
        <div className= "card" style={{ display: 'flex', flexDirection: "column", gap: '-5px', alignItems: 'center', width: '600px', height: '400px', boxShadow: '0px 0px 5px 2px rgba(0,0,0,0.25)', padding: '10px', margin: '10px'  }}>
          <Text> <b> TREASURY CARBON SINK </b> </Text>
          <PieChart
            lineWidth={30}
            animate="true"
            label={({ dataEntry }) => `${dataEntry.title} (${dataEntry.value}%)`}
            labelStyle={{
              alignContent: 'start',
              fontSize: '5px',
              fill: '#000000',
              position: 'absolute',
            }}
            data={[
              { title: 'BCT', value: Number(bct.pct), color: '#65d16f'},
              { title: 'NCT', value: Number(nct.pct), color: '#37adca'},
              { title: 'MCO2', value: Number(mco2.pct), color: '#dbf324'},
            ]}
          />
        <h3> Total CI Minted - {treasuryData.totalMinted} </h3>
        <h3> Total CO2 Offsetted - {treasuryData.carbonOffseted} </h3>
        </div>
        
        <br></br>
        
        <div>
          <div>
            <h3>Member List</h3>
            <table className="card">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Holding Amount(CI)</th>
                </tr>
              </thead>
              <tbody>
                {treasuryData.token_holders.map((member) => {
                  return (
                    <tr key={member.address}>
                      <td>{shortenAddress(member.address)}</td>
                      <td>{member.balance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Active Proposals</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                //before we do async things, we want to disable the button to prevent double clicks
                setIsVoting(true);

                // lets get the votes from the form for the values
                const votes = proposals.map((proposal) => {
                  const voteResult = {
                    proposalId: proposal.proposalId,
                    //abstain by default
                    vote: 2,
                  };
                  proposal.votes.forEach((vote) => {
                    const elem = document.getElementById(
                      proposal.proposalId + '-' + vote.type,
                    );

                    if (elem.checked) {
                      voteResult.vote = vote.type;
                      return;
                    }
                  });
                  return voteResult;
                });

                // first we need to make sure the user delegates their token to vote
                try {
                  //we'll check if the wallet still needs to delegate their tokens before they can vote
                  const delegation = await token.getDelegationOf(address);
                  // if the delegation is the 0x0 address that means they have not delegated their governance tokens yet
                  if (delegation === AddressZero) {
                    //if they haven't delegated their tokens yet, we'll have them delegate them before voting
                    await token.delegateTo(address);
                  }
                  // then we need to vote on the proposals
                  try {
                    await Promise.all(
                      votes.map(async ({ proposalId, vote: _vote }) => {
                        // before voting we first need to check whether the proposal is open for voting
                        // we first need to get the latest state of the proposal
                        const proposal = await vote.get(proposalId);
                        // then we check if the proposal is open for voting (state === 1 means it is open)
                        if (proposal.state === 1) {
                          // if it is open for voting, we'll vote on it
                          return vote.vote(proposalId, _vote);
                        }
                        // if the proposal is not open for voting we just return nothing, letting us continue
                        return;
                      }),
                    );
                    try {
                      // if any of the propsals are ready to be executed we'll need to execute them
                      // a proposal is ready to be executed if it is in state 4
                      await Promise.all(
                        votes.map(async ({ proposalId }) => {
                          // we'll first get the latest state of the proposal again, since we may have just voted before
                          const proposal = await vote.get(proposalId);

                          //if the state is in state 4 (meaning that it is ready to be executed), we'll execute the proposal
                          if (proposal.state === 4) {
                            return vote.execute(proposalId);
                          }
                        }),
                      );
                      // if we get here that means we successfully voted, so let's set the "hasVoted" state to true
                      setHasVoted(true);
                      // and log out a success message
                      console.log('successfully voted');
                    } catch (err) {
                      console.error('failed to execute votes', err);
                    }
                  } catch (err) {
                    console.error('failed to vote', err);
                  }
                } catch (err) {
                  console.error('failed to delegate tokens');
                } finally {
                  // in *either* case we need to set the isVoting state to false to enable the button again
                  setIsVoting(false);
                }
              }}
            >
              {proposals.map((proposal) => (
                <div key={proposal.proposalId} className="card">
                  <h5>{proposal.description}</h5>
                  <div>
                    {proposal.votes.map(({ type, label }) => (
                      <div key={type}>
                        <input
                          type="radio"
                          id={proposal.proposalId + '-' + type}
                          name={proposal.proposalId}
                          value={type}
                          //default the "abstain" vote to checked
                          defaultChecked={type === 2}
                        />
                        <label htmlFor={proposal.proposalId + '-' + type}>
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button disabled={isVoting || hasVoted} type="submit">
                {isVoting
                  ? 'Voting...'
                  : hasVoted
                  ? 'You Already Voted'
                  : 'Submit Votes'}
              </button>
              {!hasVoted && (
                <small>
                  This will trigger multiple transactions that you will need to
                  sign.
                </small>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Render mint nft screen.
  return (
    <div className="mint-nft">
      <h1>Mint your free ZeroCarbon🌱 NFT</h1>
      <div className="btn-hero">
        <Web3Button
          contractAddress={editionDropAddress}
          action={(contract) => {
            contract.erc721.invest(0, 1);
          }}
          onSuccess={() => {
            console.log(
              `🌊 Successfully Minted! Check it out on OpenSea: https://testnets.opensea.io/assets/${editionDrop.getAddress()}/0`,
            );
          }}
          onError={(error) => {
            console.error('Failed to mint NFT', error);
          }}
        >
          Mint your NFT (FREE)
        </Web3Button>
      </div>
    </div>
  );

  function DisplayData(data) {
    return (
      <Flex>
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>kgCO2 </td>
              <td>{data.kgCO2}</td>
            </tr>
            <tr>
              <td>transactions Count </td>
              <td>{data.transactionsCount}</td>
            </tr>
            <tr>
              <td>Gas Used </td>
              <td>{data.gasUsed}</td>
            </tr>
            <tr>
              <td>Highest Block Number </td>
              <td>{data.highestBlockNumber}</td>
            </tr>
            <tr>
              <td >Lowest Block Number</td>
              <td>{data.lowestBlockNumber}</td>
            </tr>
          </tbody>
        </table>
      </Flex>
    );
  }
};

export default App;
