window.openChatWindow = function (url) {
  window.open(url, '_blank', 'width=450,height=650,scrollbars=yes');
};

const chatroom = {
  userAvatarMap: new Map(),
  avatarIndex: 0,
  templateCache: new Map(),
  styleCache: new Set(),
  customClickHandlers: new Map(), // 存储自定义点击处理器
  templatesUrl: 'https://cdn.jsdmirror.com/gh/b23-kim/ChatRoom.js@main/ARKTemplates/', // 默认模板URL

  init: function (config) {
    if (!config || typeof config !== 'object') {
      console.error('Chatroom configuration is missing or invalid.');
      return;
    }

    const containerId = config.chatroomName;
    const jsonFilePath = config.jsonFilePath;
    const myAvatar = config.MyAvatar;
    // 新增：获取模板URL，有则用，没有则用默认
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

    // 设置自定义点击事件委托
    this.setupCustomClickDelegation(container);

    this.loadChatData(jsonFilePath)
      .then((chatData) => {
        const chatContent = this.generateChatContent(chatData, myAvatar, config.hideAvatar);
        container.innerHTML = this.generateChatBoxHTML(chatContent, config.title || '群聊的聊天记录');
      })
      .catch((err) => {
        console.error('Error loading chat data:', err);
      });
  },

  // 新增：设置自定义点击事件委托
  setupCustomClickDelegation: function(container) {
    container.addEventListener('click', (e) => {
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
    let processedContent;
    
    // 新增：处理 ARK 卡片类型
    if (element === 'ARK') {
      try {
        // 如果content是字符串，尝试解析为JSON
        if (typeof content === 'string') {
          content = JSON.parse(content);
        }
        processedContent = this.generateARKCard(content);
      } catch (e) {
        console.error('Error parsing ARK card:', e);
        processedContent = `<div class="error">卡片解析失败: ${e.message}</div>`;
      }
      //提前返回，差异化处理
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
    // 兜底：如果content既不是字符串也不是ARK，尝试转为字符串
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
  
  // 重构：动态加载卡片模板
  generateARKCard: async function(cardData) {
    try {
      // 获取卡片类型和视图
      const app = (cardData.app || '').toLowerCase();
      const view = cardData.view || 'default';
      
      // 生成模板路径 - 使用配置的templatesUrl
      const templatePath = `${this.templatesUrl}${app}/${view}.html`;
      
      // 获取模板
      const template = await this.getTemplate(templatePath);
      
      // 填充模板数据
      return this.renderTemplate(template, cardData);
    } catch (e) {
      console.error('Error generating ARK card:', e);
      return `<div class="error">卡片生成失败: ${e.message || e.toString()}</div>`;
    }
  },
  
  // 新增：获取并缓存模板
  getTemplate: async function(templatePath) {
    // 检查缓存
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath);
    }
    
    try {
      // 加载模板
      const response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error(`Failed to load template from ${templatePath}`);
      }
      
      const templateHTML = await response.text();
      
      // 缓存模板
      this.templateCache.set(templatePath, templateHTML);
      
      // 自动加载关联样式
      this.loadTemplateStyles(templateHTML);
      
      return templateHTML;
    } catch (error) {
      console.error(`Error loading template ${templatePath}:`, error);
      // 失败时使用默认模板
      return this.getDefaultTemplate();
    }
  },
  
  // 新增：加载模板中的样式
  loadTemplateStyles: function(templateHTML) {
    // 创建临时DOM元素解析模板
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = templateHTML;
    
    // 查找所有样式标签
    const styleTags = tempDiv.querySelectorAll('style, link[rel="stylesheet"]');
    
    styleTags.forEach(tag => {
      const key = tag.outerHTML;
      
      // 检查样式是否已加载
      if (this.styleCache.has(key)) return;
      
      // 注入样式
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
      
      // 缓存已加载样式
      this.styleCache.add(key);
    });
  },
  
// 重构：渲染模板 - 支持 overwrite 字段
renderTemplate: function(template, data) {
  try {
    // 检查 overwrite 配置
    const overwrite = data.overwrite || {};
    const handlerId = overwrite.clickHandlerId || this.generateHandlerId();
    
    // 存储自定义点击处理函数
    if (overwrite.clickHandler) {
      this.customClickHandlers.set(handlerId, 
        new Function('e', 'params', 'element', `with(this) { ${overwrite.clickHandler} }`).bind(this)
      );
    }
    
    // 调试：打印完整数据结构
    console.log('Template data structure:', data);
    
    // 将 handlerId 和其他 overwrite 数据注入到模板上下文中
    const context = {
      ...data,
      __clickHandlerId: handlerId,
      __overwrite: overwrite
    };
    
    // 改进的模板变量替换
    let rendered = template.replace(/{{\s*([^}]+?)\s*}}/g, (match, key) => {
      key = key.trim();
      
      // 处理特殊变量
      if (key === '__clickAttrs') {
        if (overwrite.clickHandler) {
          return `data-click-handler="${handlerId}" data-click-params='${JSON.stringify(overwrite.clickParams || {})}'`;
        }
        return '';
      }
      
      // 支持嵌套属性，如 meta.news.title
      const value = this.getNestedValue(context, key);
      
      // 调试：打印变量解析结果
      if (value === undefined) {
        console.warn(`Template variable not found: ${key}`, context);
      }
      
      // 确保返回字符串
      return value !== undefined && value !== null ? String(value) : '';
    });
    
    // 再次替换未解析的变量（双重保险）
    rendered = rendered.replace(/{{[^}]+?}}/g, '');
    
    // 调试：打印渲染后的HTML
    console.log('Rendered template:', rendered.substring(0, 200) + '...');
    
    return rendered;
  } catch (e) {
    console.error('Error rendering template:', e);
    return `<div class="error">模板渲染失败: ${e.message}</div>`;
  }
},
  
  // 新增：生成唯一处理器ID
  generateHandlerId() {
    return `handler_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  },
    
// 改进：获取嵌套对象的值
getNestedValue: function(obj, path) {
  try {
    // 处理数组索引和特殊字符
    return path.split('.').reduce((current, key) => {
      // 处理带引号的键，如 meta['news.title']
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
  
  // 新增：默认模板
  getDefaultTemplate() {
    return `
      <div class="ark-card default-card" {{__clickAttrs}} onclick="window.open('{{meta.jumpUrl}}', '_blank')">
        <div class="card-content">
          <h3>{{meta.title}}</h3>
          <p>{{meta.desc}}</p>
        </div>
        <div class="card-footer">
          <span>{{meta.source || '未知来源'}}</span>
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
          cursor: pointer;
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
