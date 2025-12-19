// 如果当前页有评论就执行函数
if (document.getElementById('post-comment')) owoBig();

function owoBig() {
    let flag = 1, 
        owo_time = '', 
        m = 3,
        currentEmotion = null; // 跟踪当前放大的表情
    
    // 创建放大容器
    let div = document.createElement('div');
    div.id = 'owo-big';
    document.body.appendChild(div);
    
    // 获取评论容器
    const commentContainer = document.getElementById('post-comment');
    
    // 表情识别配置
    const EMOTION_CONFIG = {
        classes: ['tk-owo-emotion', 'OwO-emotion', 'comment-emoji'],
        maxSize: 50,
        srcPatterns: [
            /emoji/,
            /emotion/,
            /smile/,
            /face/,
            /biaoqing/,
            /(tw|qq|bili)emoji/
        ]
    };
    
    // 禁用移动端右键菜单
    if (document.body.clientWidth <= 768) {
        commentContainer.addEventListener('contextmenu', function(e) {
            if (e.target.tagName === 'IMG' && isEmotion(e.target)) {
                e.preventDefault();
            }
        });
    }
    
    // 处理现有表情
    initExistingEmotions(commentContainer);
    
    // 监听滚动事件
    let isScrolling = false;
    window.addEventListener('scroll', () => {
        if (!isScrolling && currentEmotion) {
            isScrolling = true;
            requestAnimationFrame(updateMagnifierPosition);
        }
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        if (currentEmotion) {
            updateMagnifierPosition();
        }
    });
    
    // 监听动态添加的表情
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (isEmotionContainer(node)) {
                        bindEmotionEvents(node);
                    } else {
                        const emotionImgs = findEmotionsInNode(node);
                        if (emotionImgs.length > 0) {
                            bindEmotionEvents(node);
                        }
                    }
                }
            });
        });
    });
    
    observer.observe(commentContainer, {
        childList: true,
        subtree: true
    });
    
    // === 辅助函数 ===
    
    // 统一的位置计算函数
    function calculatePosition(img) {
        const height = img.clientHeight * m;
        const width = img.clientWidth * m;
        
        // 获取表情元素在视口中的精确位置
        const imgRect = img.getBoundingClientRect();
        
        // 动态计算垂直偏移量（基于表情大小）
        //const verticalOffset = Math.min(20, imgRect.height * 0.5); // 最大20px，最小为表情高度的一半
        const verticalOffset = -2;
        
        // 优化位置计算 - 显著减少上边距
        let left = imgRect.left - (width - imgRect.width) / 2;
        let top = imgRect.top - verticalOffset; // 应用动态偏移
        
        // 边缘检测（确保不会超出屏幕）
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        
        // 水平边缘检测
        if (left + width > viewportWidth) {
            left = viewportWidth - width - 10;
        } else if (left < 10) {
            left = 10;
        }
        
        // 垂直边缘检测
        if (top < 10) {
            // 上方空间不足时，显示在表情下方
            top = imgRect.bottom + 5;
        } else if (top + height > viewportHeight) {
            // 下方空间不足时，显示在表情上方
            top = imgRect.top - height - 5;
        }
        
        return { left, top, width, height };
    }
    
    // 更新放大面板位置
    function updateMagnifierPosition() {
        if (!currentEmotion) return;
        
        // 使用统一的位置计算函数
        const { left, top } = calculatePosition(currentEmotion);
        
        // 平滑过渡
        div.style.transition = 'top 0.2s ease, left 0.2s ease';
        div.style.left = `${left}px`;
        div.style.top = `${top}px`;
        
        isScrolling = false;
    }
    
    // 判断是否为表情图片
    function isEmotion(img) {
        if (img.tagName !== 'IMG') return false;
        const hasEmotionClass = EMOTION_CONFIG.classes.some(cls => 
            img.classList.contains(cls)
        );
        if (hasEmotionClass) return true;
        
        const { width, height } = img.getBoundingClientRect();
        if (width < EMOTION_CONFIG.maxSize && height < EMOTION_CONFIG.maxSize) {
            return true;
        }
        
        const src = img.src.toLowerCase();
        return EMOTION_CONFIG.srcPatterns.some(pattern => 
            pattern.test(src)
        );
    }
    
    // 判断是否为表情容器
    function isEmotionContainer(node) {
        const containerClasses = ['OwO-body', 'tk-owo-emotion', 'emoji-container'];
        return containerClasses.some(cls => 
            node.classList.contains(cls)
        );
    }
    
    // 在节点中查找表情图片
    function findEmotionsInNode(node) {
        return Array.from(node.querySelectorAll('img')).filter(isEmotion);
    }
    
    // 初始化已存在的表情
    function initExistingEmotions(container) {
        const emotionContainers = container.querySelectorAll('.OwO-body, .tk-owo-emotion, .emoji-container');
        emotionContainers.forEach(container => bindEmotionEvents(container));
        
        const commentContents = container.querySelectorAll('.comment-content, .tk-comment, .comment-text');
        commentContents.forEach(content => {
            const emotions = findEmotionsInNode(content);
            if (emotions.length > 0) bindEmotionEvents(content);
        });
    }
    
    // 绑定表情事件
    function bindEmotionEvents(container) {
        container.addEventListener('mouseover', handleMouseOver);
        container.addEventListener('mouseout', handleMouseOut);
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
    }
    
    // 鼠标悬停处理
    function handleMouseOver(e) {
        if (!flag || !isEmotion(e.target)) return;
        
        flag = 0;
        currentEmotion = e.target; // 记录当前表情
        owo_time = setTimeout(() => {
            showMagnified(e.target);
        }, 300);
    }
    
    // 触摸开始处理（移动端）
    function handleTouchStart(e) {
        if (!isEmotion(e.target)) return;
        
        flag = 0;
        currentEmotion = e.target; // 记录当前表情
        showMagnified(e.target);
        
        // 触摸结束隐藏
        document.body.addEventListener('touchend', () => {
            div.style.display = 'none';
            flag = 1;
            currentEmotion = null;
        }, { once: true });
    }
    
    // 鼠标移出处理
    function handleMouseOut(e) {
        if (isEmotion(e.target)) {
            div.style.display = 'none';
            flag = 1;
            clearTimeout(owo_time);
            currentEmotion = null;
        }
    }
    
    // 显示放大表情
    function showMagnified(img) {
        // 使用统一的位置计算函数
        const { left, top, width, height } = calculatePosition(img);
        
        // 设置样式
        div.style.cssText = `
            display: flex;
            height: ${height}px;
            width: ${width}px;
            left: ${left}px;
            top: ${top}px;
            z-index: 9999;
            border-radius: 8px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            overflow: hidden;
            pointer-events: none;
            transition: top 0.2s ease, left 0.2s ease;
        `;
        div.innerHTML = `<img src="${img.src}" style="width:100%;height:100%;object-fit:contain;">`;
        
        // 更新当前表情引用
        currentEmotion = img;
    }
}