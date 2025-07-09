import { JsonlStreamServer } from './core/JsonlStreamServer.js';
import { ConfigLoader } from './config/ConfigLoader.js';

async function main(): Promise<void> {
  console.log('JSONLストリームサーバーを起動中...');
  
  try {
    const configPath = process.argv[2] || './config.json';
    const configLoader = new ConfigLoader(configPath);
    const config = await configLoader.loadConfig();
    
    console.log(`設定読み込み完了: ${configPath}`);
    console.log(`監視ディレクトリ: ${config.watchDirectory}`);
    console.log(`フィルタープラグイン: ${config.plugins.filters.length}個`);
    console.log(`出力プラグイン: ${config.plugins.outputs.length}個`);
    
    const server = new JsonlStreamServer(config);
    
    // シグナルハンドラーを設定
    process.on('SIGINT', () => {
      console.log('\nシャットダウン中...');
      server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\nシャットダウン中...');
      server.stop();
      process.exit(0);
    });
    
    // サーバー開始
    server.start();
    
    console.log('JSONLストリームサーバーが起動しました');
    console.log('Ctrl+C で停止します');
    
  } catch (error) {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
  }
}


// メイン実行
main().catch(error => {
  console.error('予期しないエラー:', error);
  process.exit(1);
});