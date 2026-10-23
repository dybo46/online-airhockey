# CPU専用の試遊をGitHub Pagesで公開

リポジトリ：https://github.com/dybo46/online-airhockey

試遊：https://dybo46.github.io/online-airhockey/

Settings → Pages → Deploy from a branchでmainと/docsを指定します。配信対象はdocsだけです。自己設置版のNode.jsサーバーはPagesでは動きません。

`npm run build:demo` はself-host/publicからCPU専用版を作ります。ゲーム用APIをブラウザ内の状態へ置き換え、待受の準備を隠し、画像・音・スクリプトをサブパス対応の相対URLへ変更します。変換元の構造が変わった場合は停止するので、変換規則と公開用テストを確認してください。

音ファイルを同じサイトからfetchする以外、ゲームサーバーへの通信は不要です。作者のQNAPへ接続する経路を追加しないでください。ネット対戦をするための資料はself-hostとSELF-HOSTING.mdに分離しています。
