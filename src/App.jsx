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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Box,
  Flex,
  Text,
  Badge,
  CircularProgress 
} from "@chakra-ui/react";
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
  const CARBON_INDEX_CONTRACT = "0xD7cd60E57Cde608aa16a42315c0e2C582fb7294C";
  const API_ENDPOINT = "https://a6ef-2401-4900-1cb8-ea12-199a-c45a-4916-8a02.ngrok.io/premine"

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
    '0xecED9A151438192D0E0459C5989c4DBc26a8d79f',
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
  // The object holding emissions
  const [emissions, setEmissions] = useState({});
  const [signer, setSigner] = useState({});
  const [nftMetadata, setNftMetadata] = useState({});

  // A fancy function to shorten someones wallet address, no need to show the whole thing.
  const shortenAddress = (str) => {
    return str.substring(0, 10) + '...' + str.substring(str.length - 4);
  };

  function RenderAddress(address) {
    return <div className="badge"> Connected Address: {shortenAddress(address)} </div>
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
    const response = await fetch(`${API_ENDPOINT}`, request);
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
    if (!isNFTMinted) {
      return;
    }

    // Just like we did in the 7-airdrop-token.js file! Grab the users who hold our NFT
    // with tokenId 0.
    const getAllAddresses = async () => {
      try {
        const memberAddresses =
          await editionDrop?.history.getAllClaimerAddresses(0);
        setMemberAddresses(memberAddresses);
        console.log('🚀 Members addresses', memberAddresses);
      } catch (error) {
        console.error('failed to get member list', error);
      }
    };
    getAllAddresses();
  }, [isNFTMinted, editionDrop?.history]);

  // This useEffect grabs the # of token each member holds.
  useEffect(() => {
    if (!isNFTMinted) {
      return;
    }

    const getAllBalances = async () => {
      try {
        const amounts = await token?.history.getAllHolderBalances();
        setMemberTokenAmounts(amounts);
        console.log('👜 Amounts', amounts);
      } catch (error) {
        console.error('failed to get member balances', error);
      }
    };
    getAllBalances();
  }, [isNFTMinted, token?.history]);

  // Now, we combine the memberAddresses and memberTokenAmounts into a single array
  const memberList = useMemo(() => {
    return memberAddresses.map((address) => {
      // We're checking if we are finding the address in the memberTokenAmounts array.
      // If we are, we'll return the amount of token the user has.
      // Otherwise, return 0.
      const member = memberTokenAmounts?.find(
        ({ holder }) => holder === address,
      );

      return {
        address,
        tokenAmount: member?.balance.displayValue || '0',
      };
    });
  }, [memberAddresses, memberTokenAmounts]);

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
        <h1>Welcome to ZeroCarbon🌱</h1>
        <h2> Connect your wallet to calculate your emissions </h2>
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
        <h2>Calculate the emissions associated with your wallet</h2>
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
        <h1>Your emission💨 stats</h1>
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
              {nftMetadata.openseaUrl}
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
              ZeroCarbon🌱 Dashboard
            </Button>
          </div>
        </div>
      )
  }

  // If the user has already claimed their NFT we want to display the interal DAO page to them
  // only DAO members will see this. Render all the members + token amounts.
  if (isNFTViewed) {
    return (
      <div className="member-page">
        <h2>ZeroCarbon🌱 Member Page</h2>
        <p>There is no PlanetB. Thank you for your contributions towards solving climate change.</p>
        <div>
          <div>
            <h3>Member List</h3>
            <table className="card">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Token Amount</th>
                </tr>
              </thead>
              <tbody>
                {memberList.map((member) => {
                  return (
                    <tr key={member.address}>
                      <td>{shortenAddress(member.address)}</td>
                      <td>{member.tokenAmount}</td>
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
      <Flex justifyContent="center" alignItems="center">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Property</Th>
              <Th>Value</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>kgCO2 </Td>
              <Td style={{ padding: "4px" }}>{data.kgCO2}</Td>
            </Tr>
            <Tr>
              <Td>Transactions Count </Td>
              <Td style={{ padding: "4px" }}>{data.transactionsCount}</Td>
            </Tr>
            <Tr>
              <Td>Gas Used </Td>
              <Td style={{ padding: "4px" }}>{data.gasUsed}</Td>
            </Tr>
            <Tr>
              <Td>Highest Block Number </Td>
              <Td style={{ padding: "4px" }}>{data.highestBlockNumber}</Td>
            </Tr>
            <Tr>
              <Td borderBottomWidth="1px">Lowest Block Number</Td>
              <Td style={{ padding: "4px" }}>{data.lowestBlockNumber}</Td>
            </Tr>
          </Tbody>
        </Table>
      </Flex>
    );
  }
};

export default App;
