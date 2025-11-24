#!/usr/bin/env node
/**
 * Setup Admin User Script
 * Creates the initial admin user for the system
 */

const { createClient } = require('@supabase/supabase-js');
const AuthMiddleware = require('../middleware/auth');
const config = require('../config');
require('dotenv').config();

async function setupAdmin() {
  console.log('Setting up admin user...\n');

  // Check configuration
  if (!config.admin.email || !config.admin.password) {
    console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
    console.error('   Add these to your .env file:');
    console.error('   ADMIN_EMAIL=admin@asi360.com');
    console.error('   ADMIN_PASSWORD=YourSecurePassword123!');
    process.exit(1);
  }

  // Validate password
  const passwordValidation = AuthMiddleware.validatePassword(config.admin.password);
  if (!passwordValidation.valid) {
    console.error('❌ Admin password does not meet requirements:');
    passwordValidation.errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }

  // Initialize Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  try {
    // Check if users table exists, if not create it
    const { error: tableError } = await supabase.from('users').select('id').limit(1);

    if (tableError && tableError.code === '42P01') {
      console.log('Creating users table...');

      // Create users table
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_login TIMESTAMP WITH TIME ZONE
          );

          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        `
      });

      if (createError) {
        throw new Error(`Failed to create users table: ${createError.message}`);
      }

      console.log('✓ Users table created');
    }

    // Check if admin user already exists
    const { data: existingAdmin } = await supabase
      .table('users')
      .select('id, email')
      .eq('email', config.admin.email)
      .single();

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   ID: ${existingAdmin.id}`);
      console.log('\nTo update password, delete the user first and run this script again.');
      process.exit(0);
    }

    // Hash password
    console.log('Hashing password...');
    const hashedPassword = await AuthMiddleware.hashPassword(config.admin.password);

    // Create admin user
    console.log('Creating admin user...');
    const { data: newAdmin, error } = await supabase
      .table('users')
      .insert([
        {
          email: config.admin.email,
          password_hash: hashedPassword,
          name: 'Administrator',
          role: 'admin',
        },
      ])
      .select()
      .single();

    if (error) throw error;

    console.log('\n✅ Admin user created successfully!');
    console.log('\nCredentials:');
    console.log(`   Email: ${newAdmin.email}`);
    console.log(`   Password: ${config.admin.password}`);
    console.log(`   Role: ${newAdmin.role}`);
    console.log(`   ID: ${newAdmin.id}`);

    console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
    console.log('\nYou can now login at: http://localhost:3000/api/auth/login');
    console.log('\nTest login:');
    console.log(`curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${newAdmin.email}",
    "password": "${config.admin.password}"
  }'`);

  } catch (error) {
    console.error('\n❌ Error setting up admin user:', error.message);
    process.exit(1);
  }
}

// Run setup
setupAdmin();
