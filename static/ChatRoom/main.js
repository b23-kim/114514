window.openChatWindow = function (url) {
  window.open(url, '_blank', 'width=450,height=650,scrollbars=yes');
};

const chatroom = {
  userAvatarMap: new Map(),
  avatarIndex: 0,

  init: function (config) {
    // 保持原有初始化逻辑不变
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
        const chatContent = this.generateChatContent(chatData, myAvatar, config.hideAvatar);
        container.innerHTML = this.generateChatBoxHTML(chatContent, config.title || '群聊的聊天记录');
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

  generateChatContent: function (chatData, myAvatar, hideAvatar) {
    let content = '';
    const sysProcessed = new Set();

    chatData.forEach((chatItem) => {
      if (chatItem.name && chatItem.name.toLowerCase() === 'sys') {
        content += this.generateSystemNotification(chatItem);
        sysProcessed.add(chatItem.content);
      } else if (!sysProcessed.has(chatItem.content)) {
        content += this.generateChatItem(chatItem, myAvatar, hideAvatar);
      }
    });

    return content;
  },

  generateChatItem: function (chatItem, myAvatar, hideAvatar) {
    let name = chatItem.name ? chatItem.name.trim() : '未知';
    let element = chatItem.element ? chatItem.element.trim() : 'Text';
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
      : `<img class="chatAvatar no-lightbox" src="${avatarUrl}" onerror="this.src='https://via.placeholder.com/100';">`;

    // 处理不同类型的内容
    if (element === 'Text') {
      content = this.parseContent(content);
    } else if (element === 'ARK') {
      try {
        // 如果content是字符串，尝试解析为JSON
        if (typeof content === 'string') {
          content = JSON.parse(content);
        }
        content = this.generateARKCard(content);
      } catch (e) {
        console.error('Error parsing ARK card:', e);
        content = '<div class="error">卡片解析失败</div>';
      }
    }

    return `
      <div class="chatItem ${chatClass}">
        ${avatarHTML}
        <div class="chatContentWrapper">
          <b class="chatName">${chatName}</b>
          <div class="chatContent">${content}</div>
        </div>
      </div>
    `;
  },
  
  // 新增：生成QQ ARK卡片
  generateARKCard: function(cardData) {
    // 根据app和view字段确定卡片类型
    const app = cardData.app || '';
    const view = cardData.view || '';
    
    // 图文卡片 (news)
    if (app.includes('tuwen') && view === 'news') {
      return this.generateNewsCard(cardData);
    }
    // 聊天记录卡片
    else if (app.includes('multimsg') && view === 'contact') {
      return this.generateChatRecordCard(cardData);
    }
    // 小程序卡片
    else if (app.includes('miniprogram') || app.includes('app')) {
      return this.generateMiniProgramCard(cardData);
    }
    // 频道卡片
    else if (app.includes('guild') || app.includes('channel')) {
      return this.generateChannelCard(cardData);
    }
    // 社交关系卡片
    else if (app.includes('contact') || app.includes('social')) {
      return this.generateSocialCard(cardData);
    }
    // 默认卡片
    else {
      return this.generateDefaultCard(cardData);
    }
  },
  
  // 新增：生成图文卡片 (news)
  generateNewsCard: function(cardData) {
    const meta = cardData.meta?.news || {};
    const config = cardData.config || {};
    
    return `
      <div class="article-card" onclick="window.open('${meta.jumpUrl || '#'}', '_blank')">
        <div class="article-card-header">
          <div class="article-card-app">
            <div class="article-card-app-icon">
              <img src="${meta.tagIcon || 'https://i.imgur.com/6RcV7kO.png'}" alt="应用图标">
            </div>
            <div class="article-card-appname">${meta.tag || '腾讯内容'}</div>
          </div>
          <div class="article-card-title">${meta.title}</div>
        </div>
        <div class="article-card-content">
          <div class="article-card-description">${meta.desc}</div>
          <div class="article-card-icon">
            <img src="${meta.preview || 'https://i.imgur.com/5XvYJ3L.png'}" alt="预览图">
          </div>
        </div>
        <div class="article-card-footer">
          <div class="article-card-footer-icon">
            <img src="${meta.tagIcon || 'https://i.imgur.com/6RcV7kO.png'}" alt="来源图标">
          </div>
          <span class="article-card-source">${meta.tag || '来源'}</span>
        </div>
      </div>
    `;
  },
  
  // 新增：生成聊天记录卡片
  generateChatRecordCard: function(cardData) {
    const meta = cardData.meta?.detail || {};
    const config = cardData.config || {};
    
    // 生成预览消息
    let previewMessages = '';
    if (meta.news && Array.isArray(meta.news)) {
      meta.news.slice(0, 2).forEach(item => {
        previewMessages += `<div class="chat-message">${item.text}</div>`;
      });
    } else {
      previewMessages = `<div class="chat-message">: [图片]</div><div class="chat-message">: [图片]</div>`;
    }
    
    // 构建JSON参数
    const params = new URLSearchParams({
      jsonFilePath: config.jsonPath || '',
      title: meta.source || '群聊的聊天记录'
    });
    
    const chatLink = `https://blog.awaae001.top/Chatroom/?${params.toString()}`;
    
    return `
      <div class="chat-card" onclick="openChatWindow('${chatLink}')">
        <div class="chat-card-header">
          <h3>${meta.source || '群聊的聊天记录'}</h3>
        </div>
        <div class="chat-card-content">
          ${previewMessages}
        </div>
        <div class="chat-card-footer">
          <span>聊天记录</span>
        </div>
      </div>
    `;
  },
  
  // 新增：生成小程序卡片
  generateMiniProgramCard: function(cardData) {
    const meta = cardData.meta?.miniProgram || {};
    const config = cardData.config || {};
    
    return `
      <div class="miniprogram-card" onclick="window.open('${meta.jumpUrl || '#'}', '_blank')">
        <div class="miniprogram-card-header">
          <div class="miniprogram-card-app">
            <div class="miniprogram-card-app-icon">
              <img src="${meta.appIcon || 'https://i.imgur.com/6RcV7kO.png'}" alt="应用图标">
            </div>
            <div class="miniprogram-card-appname">${meta.appName || '小程序'}</div>
          </div>
          <div class="miniprogram-card-title">${meta.title || '小程序标题'}</div>
        </div>
        <div class="miniprogram-card-content">
          <div class="miniprogram-card-image-container">
            <img class="miniprogram-card-image" src="${meta.preview || 'https://i.imgur.com/5XvYJ3L.png'}" alt="小程序截图">
          </div>
        </div>
        <div class="miniprogram-card-footer">
          <div class="miniprogram-card-footer-icon">
            <img src="${meta.miniprogramIcon || 'https://i.imgur.com/6RcV7kO.png'}" alt="小程序图标">
          </div>
          <span class="miniprogram-card-source">${meta.source || 'QQ小程序'}</span>
        </div>
      </div>
    `;
  },
  
  // 新增：生成频道卡片
  generateChannelCard: function(cardData) {
    const meta = cardData.meta?.channel || {};
    
    return `
      <div class="channel-card" onclick="window.open('${meta.jumpUrl || '#'}', '_blank')">
        <div class="channel-card-content">
          <div class="channel-card-text">${meta.content || '频道内容'}</div>
        </div>
        <div class="channel-card-footer">
          <div class="channel-card-footer-icon">
            <img src="${meta.icon || 'https://i.imgur.com/6RcV7kO.png'}" alt="频道图标">
          </div>
          <span class="channel-card-source">${meta.name || '腾讯频道'}</span>
        </div>
      </div>
    `;
  },
  
  // 新增：生成社交关系卡片
  generateSocialCard: function(cardData) {
    const meta = cardData.meta?.contact || {};
    
    return `
      <div class="social-card" onclick="window.open('${meta.jumpUrl || '#'}', '_blank')">
        <div class="social-card-icon">
          <img src="${meta.avatar || 'https://i.imgur.com/0XZcJ4P.png'}" alt="社交图标">
        </div>
        <div class="social-card-content">
          <div class="social-card-name">${meta.name || '联系人'}</div>
        </div>
      </div>
      <div class="social-card-footer">
        <span>${meta.relation || '推荐好友'}</span>
      </div>
    `;
  },
  
  // 新增：默认卡片
  generateDefaultCard: function(cardData) {
    const meta = cardData.meta || {};
    let content = '<div class="default-card-content">';
    
    // 尝试提取一些常见字段
    if (meta.title) content += `<div class="card-title">${meta.title}</div>`;
    if (meta.desc) content += `<div class="card-desc">${meta.desc}</div>`;
    if (meta.url) content += `<div class="card-url">${meta.url}</div>`;
    
    content += '</div>';
    return content;
  },

  generateSystemNotification: function (chatItem) {
    let content = chatItem.content ? chatItem.content.trim() : '无内容';
    content = this.parseContent(content);

    return `
      <div class="systemNotification">
        <div class="systemContent">${content}</div>
      </div>
    `;
  },

  parseContent: function (content) {
    // 保持原有特殊语法解析逻辑不变
    const imagePattern = /\[:image::(https?:\/\/[^\s]+?)::\]/g;
    const chatPattern = /\[:chat:\(([^)]+)\)::([^\s]+?)::\]/g;
    const linkPattern = /\[:a::(https?:\/\/[^\s]+?)::\]/g;
    const callPattern = /\[:call::@([^:]+?)::\]/g;
    const repPattern = /\[:rep:\[([^\]]+)\]:(.*?)::\]/g;

    content = content.replace(imagePattern, (match, p1) => {
      return `<img class="chatMedia" src="${p1}" alt="Image" />`;
    });

    content = content.replace(chatPattern, (match, title, jsonFilePath) => {
      const encodedTitle = encodeURIComponent(title);
      const encodedJsonFilePath = encodeURIComponent(jsonFilePath);
      const chatLink = `https://blog.awaae001.top/Chatroom/?jsonFilePath=${encodedJsonFilePath}&title=${encodedTitle}`;
      return `
        <div class="chatQuoteCard">
          <div class="chatQuoteTetle">
            <i class="fa fa-database"></i>
            <span>转发的聊天记录</span>
          </div>
          <a class="chatMessage" onclick="openChatWindow('${chatLink}')">转发自：${title}</a>
        </div>
      `;
    });

    content = content.replace(linkPattern, (match, p1) => {
      return `<a href="${p1}" class="chatLink" target="_blank">${p1}</a>`;
    });

    content = content.replace(callPattern, (match, username) => {
      return `<span class="chatCall">@${username}</span>`;
    });

    content = content.replace(repPattern, (match, username, quotedContent) => {
      return `
        <div class="chatQuote">
          <div class="quoteUser">
            <i class="fa fa-share-square-o"></i>
            <span>${username}</span>
          </div>
          <span class="quotedMessage">${quotedContent}</span>
        </div>
      `;
    });

    return content;
  },

  assignAvatar: function (name) {
    const avatars = [
      'https://i.p-i.vip/30/20240920-66ed9a608c2cf.png',
      'https://i.p-i.vip/30/20240920-66ed9b0655cba.png',
      'https://i.p-i.vip/30/20240920-66ed9b18a56ee.png',
      'https://i.p-i.vip/30/20240920-66ed9b2c199bf.png',
      'https://i.p-i.vip/30/20240920-66ed9b3350ed1.png',
      'https://i.p-i.vip/30/20240920-66ed9b5181630.png',
    ];

    if (!this.userAvatarMap.has(name)) {
      this.userAvatarMap.set(name, avatars[this.avatarIndex % avatars.length]);
      this.avatarIndex++;
    }
    return this.userAvatarMap.get(name);
  },
};

if (typeof chatroom.init === 'object') {
  document.addEventListener('DOMContentLoaded', function () {
    chatroom.init(chatroom.init);
  });
}
