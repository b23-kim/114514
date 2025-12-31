// 检查 chatroom 是否已定义，防止重复声明
if (typeof window.chatroom === 'undefined') {
  window.chatroom = {
    userAvatarMap: new Map(),
    avatarIndex: 0,
    templateCache: new Map(),
    styleCache: new Set(),
    customClickHandlers: new Map(),
    templatesUrl: 'https://cdn.jsdmirror.com/gh/b23-kim/ChatRoom.js@main/ARKTemplates/',

    init: function (config) {
      // 检查是否已初始化
      const container = document.getElementById(config.chatroomName);
      if (container && container.innerHTML.trim() !== '') {
        console.log(`Chatroom with id "${config.chatroomName}" already initialized`);
        return;
      }

      if (!config || typeof config !== 'object') {
        console.error('Chatroom configuration is missing or invalid.');
        return;
      }

      const containerId = config.chatroomName;
      const jsonFilePath = config.jsonFilePath;
      const myAvatar = config.MyAvatar;
      this.templatesUrl = config.templatesUrl || this.templatesUrl;

      if (!containerId || !jsonFilePath || !myAvatar) {
        console.error('Chatroom name (containerId), JSON file path, and MyAvatar must be provided.');
        return;
      }

      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`Chat container with id "${containerId}" not found.`);
        return;
      }

      this.setupCustomClickDelegation(container);

      this.loadChatData(jsonFilePath)
        .then((chatData) => {
          this.generateChatContent(chatData, myAvatar, config.hideAvatar).then(chatContent => {
            if (document.getElementById(containerId)) {
              container.innerHTML = this.generateChatBoxHTML(chatContent, config.title || '群聊的聊天记录');
            }
          });
        })
        .catch((err) => {
          console.error('Error loading chat ', err);
        });
    },

    setupCustomClickDelegation: function(container) {
      // 移除已存在的事件监听器
      const clone = container.cloneNode(true);
      container.parentNode.replaceChild(clone, container);
      
      clone.addEventListener('click', (e) => {
        const target = e.target.closest('[data-click-handler]');
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          
          const handlerId = target.dataset.clickHandler;
          const params = target.dataset.clickParams ? JSON.parse(target.dataset.clickParams) : {};
          
          if (this.customClickHandlers.has(handlerId)) {
            this.customClickHandlers.get(handlerId).call(this, e, params, target);
          } else {
            console.warn(`Custom click handler "${handlerId}" not found`);
          }
        }
      }, true);
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

    generateChatItem: async function (chatItem, myAvatar, hideAvatar) {
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
        avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=  ${avatar}&s=100`;
      } else {
        avatarUrl = this.assignAvatar(name);
      }

      const avatarHTML = hideAvatar
        ? ''
        : `<img class="chatAvatar no-lightbox" src="${avatarUrl}" onerror="this.src='https://via.placeholder.com/100';">`;

      let processedContent;
      
      if (element === 'ARK') {
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
      else if (typeof content === 'string') {
        processedContent = this.parseContent(content.trim());
      } 
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
      try {
        const app = (cardData.app || '').toLowerCase();
        const view = cardData.view || 'default';
        
        const templatePath = `${this.templatesUrl}${app}/${view}.html`;
        
        const template = await this.getTemplate(templatePath);
        
        return this.renderTemplate(template, cardData);
      } catch (e) {
        console.error('Error generating ARK card:', e);
        return `<div class="error">卡片生成失败: ${e.message || e.toString()}</div>`;
      }
    },
    
    getTemplate: async function(templatePath) {
      if (this.templateCache.has(templatePath)) {
        return this.templateCache.get(templatePath);
      }
      
      try {
        const response = await fetch(templatePath);
        if (!response.ok) {
          throw new Error(`Failed to load template from ${templatePath}`);
        }
        
        const templateHTML = await response.text();
        
        this.templateCache.set(templatePath, templateHTML);
        
        this.loadTemplateStyles(templateHTML);
        
        return templateHTML;
      } catch (error) {
        console.error(`Error loading template ${templatePath}:`, error);
        return this.getDefaultTemplate();
      }
    },
    
    loadTemplateStyles: function(templateHTML) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = templateHTML;
      
      const styleTags = tempDiv.querySelectorAll('style, link[rel="stylesheet"]');
      
      styleTags.forEach(tag => {
        const key = tag.outerHTML;
        
        if (this.styleCache.has(key)) return;
        
        if (tag.tagName === 'STYLE') {
          const style = document.createElement('style');
          style.innerHTML = tag.innerHTML;
          document.head.appendChild(style);
        } else if (tag.tagName === 'LINK') {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = tag.href;
          document.head.appendChild(link);
        }
        
        this.styleCache.add(key);
      });
    },
    
    renderTemplate: function(template, data) {
      try {
        const overwrite = data.overwrite || {};
        const handlerId = overwrite.clickHandlerId || this.generateHandlerId();
        
        if (overwrite.clickHandler) {
          this.customClickHandlers.set(handlerId, 
            new Function('e', 'params', 'element', `with(this) { ${overwrite.clickHandler} }`).bind(this)
          );
        }
        
        const context = {
          ...data,
          __clickHandlerId: handlerId,
          __overwrite: overwrite
        };
        
        let rendered = template.replace(/{{\s*([^}]+?)\s*}}/g, (match, key) => {
          key = key.trim();
          
          if (key === '__clickAttrs') {
            if (overwrite.clickHandler) {
              return `data-click-handler="${handlerId}" data-click-params='${JSON.stringify(overwrite.clickParams || {})}'`;
            }
            return '';
          }
          
          const value = this.getNestedValue(context, key);
          
          if (value === undefined) {
            console.warn(`Template variable not found: ${key}`, context);
          }
          
          return value !== undefined && value !== null ? String(value) : '';
        });
        
        rendered = rendered.replace(/{{[^}]+?}}/g, '');
        
        return rendered;
      } catch (e) {
        console.error('Error rendering template:', e);
        return `<div class="error">模板渲染失败: ${e.message}</div>`;
      }
    },
    
    generateHandlerId() {
      return `handler_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    },
      
    getNestedValue: function(obj, path) {
      try {
        return path.split('.').reduce((current, key) => {
          if (key.includes('[')) {
            const match = key.match(/(\w+)\[['"]?([^'"]+)['"]?\]/);
            if (match) {
              return current && current[match[1]] ? current[match[1]][match[2]] : undefined;
            }
          }
          return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
      } catch (e) {
        console.error(`Error getting nested value for path '${path}':`, e);
        return undefined;
      }
    },
      
    getDefaultTemplate() {
      return `
        <div class="ark-card default-card">
          <div class="card-content">
            <h3>卡片加载异常</h3>
            <p>ARK内容显示失败</p>
          </div>
        </div>
        <style>
          .ark-card {
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            overflow: hidden;
            background-color: #FFFFFF;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
            margin: 12px 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          .card-content {
            padding: 16px;
          }
          .card-footer {
            padding: 8px 16px;
            border-top: 1px solid #f0f0f0;
            background-color: #fafafa;
            font-size: 13px;
            color: #999;
          }
        </style>
      `;
    },

    generateSystemNotification: function (chatItem) {
      let content = chatItem.content;
      if (typeof content === 'string') {
        content = this.parseContent(content.trim());
      } else {
        content = JSON.stringify(content);
      }

      return `
        <div class="systemNotification">
          <div class="systemContent">${content}</div>
        </div>
      `;
    },

    parseContent: function (content) {
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
}

// 安全的初始化
function initChatRoomWhenReady() {
  if (typeof window.chatroom !== 'undefined' && typeof chatroom.init === 'function' && typeof chatroom.init === 'object') {
    try {
      // 检查是否需要初始化
      const config = chatroom.init;
      const container = document.getElementById(config.chatroomName);
      if (container && container.innerHTML.trim() === '' && !container.dataset.initialized) {
        container.dataset.initialized = 'true';
        chatroom.init(config);
      }
    } catch (e) {
      console.error('Error initializing chatroom:', e);
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initChatRoomWhenReady);

// PJAX 支持
document.addEventListener('pjax:complete', initChatRoomWhenReady);
document.addEventListener('turbolinks:load', initChatRoomWhenReady);

// 兼容旧版初始化
if (typeof chatroom.init === 'object') {
  window.addEventListener('load', function() {
    if (typeof window.chatroom !== 'undefined' && typeof chatroom.init === 'function' && typeof chatroom.init === 'object') {
      initChatRoomWhenReady();
    }
  });
}
