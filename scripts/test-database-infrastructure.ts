import { DatabaseConnection } from '../app/src/lib/database/connection';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  duration: number;
}

class DatabaseInfrastructureTest {
  private results: TestResult[] = [];
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      this.results.push({
        test: testName,
        status: 'PASS',
        message: 'Test completed successfully',
        duration: Date.now() - startTime
      });
      console.log(`✅ ${testName} - PASS (${Date.now() - startTime}ms)`);
    } catch (error) {
      this.results.push({
        test: testName,
        status: 'FAIL',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      console.log(`❌ ${testName} - FAIL (${Date.now() - startTime}ms)`);
      console.log(`   Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  async testDatabaseConnection(): Promise<void> {
    await this.runTest('Database Connection', async () => {
      const result = await this.db.query('SELECT NOW() as current_time');
      if (!result.rows[0].current_time) {
        throw new Error('No response from database');
      }
    });
  }

  async testDatabaseSchema(): Promise<void> {
    await this.runTest('Database Schema Validation', async () => {
      // Check if all required tables exist
      const requiredTables = [
        'users', 'trades', 'liquidity_positions', 'orders', 
        'portfolio_snapshots', 'notifications', 'user_sessions'
      ];

      for (const table of requiredTables) {
        const result = await this.db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [table]);

        if (!result.rows[0].exists) {
          throw new Error(`Required table '${table}' does not exist`);
        }
      }
    });
  }

  async testBasicOperations(): Promise<void> {
    await this.runTest('Basic Database Operations', async () => {
      // Test user creation
      const testWallet = 'test_wallet_' + Date.now();
      const userResult = await this.db.query(`
        INSERT INTO users (wallet_address, email, username, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id, wallet_address
      `, [testWallet, 'test@example.com', 'testuser']);

      if (!userResult.rows[0]) {
        throw new Error('User creation failed');
      }

      const userId = userResult.rows[0].id;

      // Test user retrieval
      const retrieveResult = await this.db.query(`
        SELECT id, wallet_address FROM users WHERE id = $1
      `, [userId]);

      if (!retrieveResult.rows[0] || retrieveResult.rows[0].wallet_address !== testWallet) {
        throw new Error('User retrieval failed');
      }

      // Test trade creation
      const tradeResult = await this.db.query(`
        INSERT INTO trades (user_id, type, side, base_asset, quote_asset, base_amount, quote_amount, price, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [userId, 'spot', 'buy', 'SOL', 'USDC', 1.0, 100.0, 100.0, 'confirmed']);

      if (!tradeResult.rows[0]) {
        throw new Error('Trade creation failed');
      }

      // Cleanup
      const tradeId = tradeResult.rows[0].id;
      await this.db.query('DELETE FROM trades WHERE id = $1', [tradeId]);
      await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  }

  async testAnalyticsSchema(): Promise<void> {
    await this.runTest('Analytics Schema Validation', async () => {
      // Check analytics tables
      const analyticsResult = await this.db.analyticsQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('user_events', 'trading_analytics', 'page_views', 'performance_metrics')
        ORDER BY table_name
      `);

      const expectedTables = ['page_views', 'performance_metrics', 'trading_analytics', 'user_events'];
      const foundTables = analyticsResult.rows.map(row => row.table_name).sort();

      if (foundTables.length !== expectedTables.length) {
        throw new Error(`Expected ${expectedTables.length} analytics tables, found ${foundTables.length}`);
      }

      for (let i = 0; i < expectedTables.length; i++) {
        if (foundTables[i] !== expectedTables[i]) {
          throw new Error(`Missing analytics table: ${expectedTables[i]}`);
        }
      }
    });
  }

  async testAnalyticsOperations(): Promise<void> {
    await this.runTest('Analytics Operations', async () => {
      const testUserId = 'test_user_' + Date.now();
      const testSessionId = 'test_session_' + Date.now();

      // Test event tracking
      await this.db.analyticsQuery(`
        INSERT INTO user_events (user_id, session_id, event_type, event_data, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
      `, [testUserId, testSessionId, 'test_event', JSON.stringify({ test: 'data' })]);

      // Test page view tracking
      await this.db.analyticsQuery(`
        INSERT INTO page_views (user_id, session_id, page_url, referrer, user_agent, timestamp)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [testUserId, testSessionId, '/test', '', 'test-agent']);

      // Test trading analytics
      await this.db.analyticsQuery(`
        INSERT INTO trading_analytics (user_id, trade_id, trade_type, side, base_asset, quote_asset, amount, price, fees, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [testUserId, 'test_trade_123', 'spot', 'buy', 'SOL', 'USDC', 1.0, 100.0, 0.25]);

      // Verify data was inserted
      const eventCount = await this.db.analyticsQuery(`
        SELECT COUNT(*) as count FROM user_events WHERE user_id = $1
      `, [testUserId]);

      if (parseInt(eventCount.rows[0].count) === 0) {
        throw new Error('Analytics event insertion failed');
      }

      // Cleanup
      await this.db.analyticsQuery('DELETE FROM user_events WHERE user_id = $1', [testUserId]);
      await this.db.analyticsQuery('DELETE FROM page_views WHERE user_id = $1', [testUserId]);
      await this.db.analyticsQuery('DELETE FROM trading_analytics WHERE user_id = $1', [testUserId]);
    });
  }

  async testBackupConfiguration(): Promise<void> {
    await this.runTest('Backup Configuration', async () => {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Test backup directory
      const backupDir = path.join(process.cwd(), 'database', 'backups');
      try {
        await fs.access(backupDir);
      } catch {
        throw new Error('Backup directory does not exist');
      }

      // Test backup script
      const backupScript = path.join(process.cwd(), 'scripts', 'backup.sh');
      try {
        await fs.access(backupScript);
      } catch {
        throw new Error('Backup script not found');
      }

      // Test restore script
      const restoreScript = path.join(process.cwd(), 'scripts', 'restore.sh');
      try {
        await fs.access(restoreScript);
      } catch {
        throw new Error('Restore script not found');
      }
    });
  }

  async testDockerConfiguration(): Promise<void> {
    await this.runTest('Docker Configuration', async () => {
      const fs = require('fs').promises;
      const path = require('path');

      // Test docker-compose.yml
      const dockerCompose = path.join(process.cwd(), 'docker-compose.yml');
      try {
        const content = await fs.readFile(dockerCompose, 'utf8');
        if (!content.includes('postgres') || !content.includes('redis')) {
          throw new Error('Docker compose missing required services');
        }
      } catch {
        throw new Error('Docker compose file not found or invalid');
      }

      // Test Dockerfile
      const dockerfile = path.join(process.cwd(), 'Dockerfile');
      try {
        await fs.access(dockerfile);
      } catch {
        throw new Error('Dockerfile not found');
      }
    });
  }

  async testEnvironmentConfiguration(): Promise<void> {
    await this.runTest('Environment Configuration', async () => {
      const fs = require('fs').promises;
      const path = require('path');

      // Test .env.example
      const envExample = path.join(process.cwd(), '.env.example');
      try {
        const content = await fs.readFile(envExample, 'utf8');
        const requiredVars = [
          'DATABASE_URL', 'ANALYTICS_DATABASE_URL', 'REDIS_URL',
          'REDIS_SESSION_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'
        ];

        for (const varName of requiredVars) {
          if (!content.includes(varName)) {
            throw new Error(`Missing environment variable: ${varName}`);
          }
        }
      } catch {
        throw new Error('.env.example file not found or invalid');
      }
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Database Infrastructure Integration Tests...\n');

    await this.testDatabaseConnection();
    await this.testDatabaseSchema();
    await this.testAnalyticsSchema();
    await this.testBasicOperations();
    await this.testAnalyticsOperations();
    await this.testBackupConfiguration();
    await this.testDockerConfiguration();
    await this.testEnvironmentConfiguration();

    this.printSummary();
  }

  printSummary(): void {
    console.log('\n📊 Test Summary:');
    console.log('==================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log(`🎯 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.test}: ${r.message}`));
    }

    console.log('\n🏁 Database Infrastructure Testing Complete!');
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Your database infrastructure is ready for production.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix the issues before deploying.');
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

// Run tests if this script is executed directly
async function main() {
  const tester = new DatabaseInfrastructureTest();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('Fatal error during testing:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { DatabaseInfrastructureTest };
