#!/usr/bin/env node

/**
 * Test script to verify team deletion functionality
 * Run this after starting the server to test the delete API
 */

const axios = require('axios').default;

const SERVER_URL = 'http://localhost:3001';

async function testTeamDeletion() {
  try {
    console.log('🧪 Testing Team Deletion Functionality\n');
    
    // Step 1: Create a test team
    console.log('1. Creating a test team...');
    const createResponse = await axios.post(`${SERVER_URL}/api/teams`, {
      name: 'Test Delete Team',
      description: 'This team will be deleted for testing purposes',
      leaderId: null,
      leaderUsername: null
    });
    
    if (createResponse.data.success) {
      const testTeamId = createResponse.data.teamId;
      console.log(`✅ Test team created with ID: ${testTeamId}`);
      
      // Step 2: Verify team exists by fetching all teams
      console.log('\n2. Verifying team exists in database...');
      const getAllResponse = await axios.get(`${SERVER_URL}/api/teams`);
      const createdTeam = getAllResponse.data.teams.find(team => team.id === testTeamId);
      
      if (createdTeam) {
        console.log(`✅ Team found: ${createdTeam.name} (ID: ${createdTeam.id})`);
        
        // Step 3: Delete the team
        console.log('\n3. Deleting the test team...');
        const deleteResponse = await axios.delete(`${SERVER_URL}/api/teams/${testTeamId}`);
        
        if (deleteResponse.data.success) {
          console.log(`✅ Team deleted successfully: ${deleteResponse.data.message}`);
          
          // Step 4: Verify team no longer exists
          console.log('\n4. Verifying team was removed from database...');
          const verifyResponse = await axios.get(`${SERVER_URL}/api/teams`);
          const deletedTeam = verifyResponse.data.teams.find(team => team.id === testTeamId);
          
          if (!deletedTeam) {
            console.log('✅ Team successfully removed from database');
            console.log('\n🎉 TEST PASSED: Team deletion functionality is working correctly!');
          } else {
            console.log('❌ Team still exists in database after deletion');
            console.log('\n💥 TEST FAILED: Team was not properly deleted');
          }
        } else {
          console.log(`❌ Failed to delete team: ${deleteResponse.data.message}`);
          console.log('\n💥 TEST FAILED: Delete request was unsuccessful');
        }
      } else {
        console.log('❌ Created team not found in database');
        console.log('\n💥 TEST FAILED: Team creation verification failed');
      }
    } else {
      console.log(`❌ Failed to create test team: ${createResponse.data.message}`);
      console.log('\n💥 TEST FAILED: Could not create test team');
    }
    
  } catch (error) {
    console.log('\n❌ Test failed with error:', error.message);
    
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running on http://localhost:3001');
      console.log('   Run: npm run server');
    }
  }
}

// Run the test
testTeamDeletion();
