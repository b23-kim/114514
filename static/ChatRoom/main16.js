// 立即执行函数确保全局作用域
(function() {
  // 检查是否已存在 chatroom，避免重复定义
  if (window.chatroom && typeof window.chatroom.init === 'function') {
    return;
  }

  // 聊天窗口打开函数
  window.openChatWindow = function (url) {
    window.open(url, '_blank', 'width=450,height=650,scrollbars=yes');
  };

  // 创建 chatroom 对象
  window.chatroom = {
    userAvatarMap: new Map(),
    avatarIndex: 0,
    
    init: function (config) {
      if (!config || typeof config !== 'object') {
        console.error('Chatroom configuration is missing or invalid.');
        return;
      }

      const containerId = config.chatroomName;
      const jsonFilePath = config.jsonFilePath;
      const myAvatar = config.MyAvatar;

      if (!containerId || !jsonFilePath || !myAvatar) {
        console.error('Chatroom name (containerId), JSON file path, and MyAvatar must be provided.');
        return;
      }

      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`Chat container with id "${containerId}" not found.`);
        return;
      }

      this.loadChatData(jsonFilePath)
        .then((chatData) => {
          // 使用 async/await 处理 Promise
          this.generateChatContent(chatData, myAvatar, config.hideAvatar)
            .then(chatContent => {
              container.innerHTML = this.generateChatBoxHTML(chatContent, config.title || '群聊的聊天记录');
            });
        })
        .catch((err) => {
          console.error('Error loading chat data:', err);
        });
    },

    loadChatData: function (filePath) {
      return fetch(filePath)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load chat data from ${filePath}`);
          }
          return response.json();
        });
    },

    generateChatBoxHTML: function (content, title) {
      const titleHtml = `<div class="chatBoxTitle"><i class="fa fa-chevron-left"></i><span class="chatTitleText">${title}</span><div class="chatBoxIcons"><i class="fa fa-group"></i><i class="fa fa-dedent"></i></div></div>`;
      return `<div class="chatContainer">${titleHtml}<div class="chatBox">${content}</div></div>`;
    },

    // 异步函数
    generateChatContent: async function (chatData, myAvatar, hideAvatar) {
      let content = '';
      const sysProcessed = new Set();

      for (const chatItem of chatData) {
        if (chatItem.name && chatItem.name.toLowerCase() === 'sys') {
          content += this.generateSystemNotification(chatItem);
          sysProcessed.add(chatItem.content);
        } else if (!sysProcessed.has(chatItem.content)) {
          content += await this.generateChatItem(chatItem, myAvatar, hideAvatar);
        }
      }

      return content;
    },

    // 异步函数
    generateChatItem: async function (chatItem, myAvatar, hideAvatar) {
      let name = chatItem.name ? chatItem.name.trim() : '未知';
      let content = chatItem.content ? chatItem.content : '无内容';
      let avatar = chatItem.avatar || null;

      const isMe = name.toLowerCase() === 'me';
      const chatName = isMe ? '我' : name;
      const chatClass = isMe ? 'me' : '';

      let avatarUrl;
      if (isMe) {
        avatarUrl = myAvatar;
      } else if (avatar && avatar.startsWith('http')) {
        avatarUrl = avatar;
      } else if (avatar && !isNaN(Number(avatar))) {
        avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${avatar}&s=100`;
      } else {
        avatarUrl = this.assignAvatar(name);
      }

      const avatarHTML = hideAvatar
        ? ''
        : `<img class="chatAvatar no-lightbox" src="${avatarUrl}" onerror="this.src='https://via.placeholder.com/100  ';">`;

      let processedContent;

      // 处理 ARK 卡片类型
      if (chatItem.element === 'ARK') {
        try {
          if (typeof content === 'string') {
            content = JSON.parse(content);
          }
          processedContent = await this.generateARKCard(content);
        } catch (e) {
          console.error('Error parsing ARK card:', e);
          processedContent = `<div class="error">卡片解析失败: ${e.message}</div>`;
        }
        return `
        <div class="chatItem ${chatClass}">
          ${avatarHTML}
          <div class="chatContentWrapper">
            <b class="chatName">${chatName}</b>
            <div>${processedContent}</div>
          </div>
        </div>
      `;
      } 
      // 处理普通文本
      else if (typeof content === 'string') {
        processedContent = this.parseContent(content.trim());
      } 
      // 兜底
      else {
        processedContent = typeof content === 'object' ? 
          JSON.stringify(content) : 
          String(content);
      }

      return `
        <div class="chatItem ${chatClass}">
          ${avatarHTML}
          <div class="chatContentWrapper">
            <b class="chatName">${chatName}</b>
            <div class="chatContent">${processedContent}</div>
          </div>
        </div>
      `;
    },
    
    generateARKCard: async function(cardData) {
      // 这里是您的原有实现
      // 为了简洁这里省略，保持原有代码
      return '<div>ARK卡片内容</div>';
    },
    
    // 其他方法
    generateSystemNotification: function (chatItem) {
      // 原有代码
      const content = chatItem.content || '';
      return `<div class="sysNotification">${content}</div>`;
    },
    
    parseContent: function (content) {
      // 简单示例，根据您的实际需求修改
      return content
        .replace(/\[表情\]/g, '😊')
        .replace(/\n/g, '<br>');
    },
    
    assignAvatar: function (name) {
      const avatars = [
        'https://i.p-i.vip/30/20240920-66ed9a608c2cf.png  ',
        'https://i.p-i.vip/30/20240920-66ed9b0655cba.png  ',
        'https://i.p-i.vip/30/20240920-66ed9b18a56ee.png  ',
        'https://i.p-i.vip/30/20240920-66ed9b2c199bf.png  ',
        'https://i.p-i.vip/30/20240920-66ed9b3350ed1.png  ',
        'https://i.p-i.vip/30/20240920-66ed9b5181630.png  ',
      ];

      if (!this.userAvatarMap.has(name)) {
        this.userAvatarMap.set(name, avatars[this.avatarIndex % avatars.length]);
        this.avatarIndex++;
      }
      return this.userAvatarMap.get(name);
    },
    
    // 添加PJAX支持
    setupPjaxSupport: function() {
      // 检查是否已添加过事件监听器
      if (this._pjaxListenerAdded) return;
      
      document.addEventListener('pjax:complete', () => {
        // 重新初始化所有聊天室
        document.querySelectorAll('[data-chatroom]').forEach(element => {
          try {
            const config = JSON.parse(element.getAttribute('data-chatroom'));
            if (window.chatroom && typeof window.chatroom.init === 'function') {
              window.chatroom.init(config);
            }
          } catch (e) {
            console.error('Error parsing chatroom config:', e);
          }
        });
      });
      
      this._pjaxListenerAdded = true;
    }
  };
  
  // 初始化完成后设置PJAX支持
  window.chatroom.setupPjaxSupport();
  
  // DOM加载完成后初始化所有聊天室
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-chatroom]').forEach(element => {
      try {
        const config = JSON.parse(element.getAttribute('data-chatroom'));
        if (window.chatroom && typeof window.chatroom.init === 'function') {
          window.chatroom.init(config);
        }
      } catch (e) {
        console.error('Error parsing chatroom config:', e);
      }
    });
  });
  
  // 立即检查DOM中已有的聊天室（用于PJAX首次加载）
  if (document.readyState === 'loading') {
    // DOM仍在加载，等待
  } else {
    // DOM已加载，立即执行
    document.querySelectorAll('[data-chatroom]').forEach(element => {
      try {
        const config = JSON.parse(element.getAttribute('data-chatroom'));
        if (window.chatroom && typeof window.chatroom.init === 'function') {
          window.chatroom.init(config);
        }
      } catch (e) {
        console.error('Error parsing chatroom config:', e);
      }
    });
  }
})();
