#!/usr/bin/env node
/**
 * Test script to verify Expo push notification setup
 * Run: node scripts/test-notification.js <push_token>
 */

require('dotenv').config();
const { Expo } = require('expo-server-sdk');

const testNotification = async (pushToken) => {
  console.log('🧪 Testing Expo Push Notification...\n');
  
  // Check if access token is configured
  if (!process.env.EXPO_ACCESS_TOKEN) {
    console.error('❌ EXPO_ACCESS_TOKEN not found in .env file');
    process.exit(1);
  }
  
  console.log('✅ EXPO_ACCESS_TOKEN found');
  
  // Initialize Expo
  const expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
    useFcmV1: true,
  });
  
  console.log('✅ Expo SDK initialized');
  
  // Validate push token
  if (!pushToken) {
    console.error('❌ Push token not provided');
    console.log('\nUsage: node scripts/test-notification.js <ExponentPushToken[...]>');
    process.exit(1);
  }
  
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`❌ Invalid push token format: ${pushToken}`);
    console.log('Expected format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    process.exit(1);
  }
  
  console.log(`✅ Push token validated: ${pushToken.substring(0, 30)}...`);
  
  // Create test message
  const message = {
    to: pushToken,
    sound: 'default',
    title: '🧪 Test Notification',
    body: 'This is a test notification from Hein Pharmacy Server',
    data: { 
      type: 'test',
      timestamp: new Date().toISOString()
    },
    priority: 'high',
    channelId: 'default',
  };
  
  console.log('\n📤 Sending test notification...');
  
  try {
    const ticketChunk = await expo.sendPushNotificationsAsync([message]);
    console.log('\n✅ Notification sent successfully!');
    console.log('Ticket:', JSON.stringify(ticketChunk, null, 2));
    
    // Check for errors in ticket
    if (ticketChunk[0].status === 'error') {
      console.error('\n❌ Notification failed:', ticketChunk[0].message);
      console.error('Details:', ticketChunk[0].details);
    } else {
      console.log('\n✅ Notification ticket created successfully');
      console.log('Check your device for the notification!');
    }
    
  } catch (error) {
    console.error('\n❌ Error sending notification:', error.message);
    process.exit(1);
  }
};

// Run the test
const pushToken = process.argv[2];
testNotification(pushToken)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
