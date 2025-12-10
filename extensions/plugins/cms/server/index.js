/**
 * CMS Plugin
 * 
 * Content Management System - 提供博客文章、页面、分类、标签和媒体管理功能
 */

const fp = require('fastify-plugin');

// Slug 生成器
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function cmsPlugin(fastify, options) {
  const {
    postsPerPage = 10,
    enableComments = true,
    enableRevisions = true,
    maxRevisions = 10,
  } = options;

  fastify.log.info('CMS plugin initializing...');

  // ==================== Posts API ====================
  
  // 获取所有文章
  fastify.get('/posts', async (request, reply) => {
    const { page = 1, limit = postsPerPage, status, categoryId, tagId } = request.query;
    const skip = (page - 1) * limit;
    
    const where = {};
    if (status) where.status = status;
    if (categoryId) where.categories = { some: { id: parseInt(categoryId) } };
    if (tagId) where.tags = { some: { id: parseInt(tagId) } };

    const [posts, total] = await Promise.all([
      fastify.prisma.cmsPost.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { categories: true, tags: true, author: { select: { id: true, name: true } } },
      }),
      fastify.prisma.cmsPost.count({ where }),
    ]);

    return { success: true, data: { posts, total, page: parseInt(page), limit: parseInt(limit) } };
  });

  // 获取单篇文章
  fastify.get('/posts/:slug', async (request, reply) => {
    const { slug } = request.params;
    const post = await fastify.prisma.cmsPost.findUnique({
      where: { slug },
      include: { categories: true, tags: true, author: { select: { id: true, name: true } } },
    });
    if (!post) return reply.status(404).send({ success: false, error: 'POST_NOT_FOUND' });
    return { success: true, data: { post } };
  });

  // 创建文章
  fastify.post('/posts', async (request, reply) => {
    const { title, content, excerpt, status = 'DRAFT', categoryIds = [], tagIds = [] } = request.body;
    const slug = slugify(title) + '-' + Date.now().toString(36);
    
    const post = await fastify.prisma.cmsPost.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        status,
        authorId: request.user?.id || 'system',
        categories: { connect: categoryIds.map(id => ({ id })) },
        tags: { connect: tagIds.map(id => ({ id })) },
      },
      include: { categories: true, tags: true },
    });
    return { success: true, data: { post } };
  });

  // 更新文章
  fastify.put('/posts/:id', async (request, reply) => {
    const { id } = request.params;
    const { title, content, excerpt, status, categoryIds, tagIds } = request.body;
    
    const updateData = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (excerpt) updateData.excerpt = excerpt;
    if (status) updateData.status = status;
    if (categoryIds) updateData.categories = { set: categoryIds.map(id => ({ id })) };
    if (tagIds) updateData.tags = { set: tagIds.map(id => ({ id })) };

    const post = await fastify.prisma.cmsPost.update({
      where: { id },
      data: updateData,
      include: { categories: true, tags: true },
    });
    return { success: true, data: { post } };
  });

  // 删除文章
  fastify.delete('/posts/:id', async (request, reply) => {
    const { id } = request.params;
    await fastify.prisma.cmsPost.delete({ where: { id } });
    return { success: true, message: 'Post deleted successfully' };
  });

  // 发布文章
  fastify.post('/posts/:id/publish', async (request, reply) => {
    const { id } = request.params;
    const post = await fastify.prisma.cmsPost.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    return { success: true, data: { post } };
  });

  // ==================== Pages API ====================
  
  // 获取所有页面
  fastify.get('/pages', async (request, reply) => {
    const pages = await fastify.prisma.cmsPage.findMany({
      orderBy: { order: 'asc' },
    });
    return { success: true, data: { pages } };
  });

  // 获取单个页面
  fastify.get('/pages/:slug', async (request, reply) => {
    const { slug } = request.params;
    const page = await fastify.prisma.cmsPage.findUnique({ where: { slug } });
    if (!page) return reply.status(404).send({ success: false, error: 'PAGE_NOT_FOUND' });
    return { success: true, data: { page } };
  });

  // 创建页面
  fastify.post('/pages', async (request, reply) => {
    const { title, content, template = 'default', parentId } = request.body;
    const slug = slugify(title) + '-' + Date.now().toString(36);
    
    const page = await fastify.prisma.cmsPage.create({
      data: { title, slug, content, template, parentId },
    });
    return { success: true, data: { page } };
  });

  // 更新页面
  fastify.put('/pages/:id', async (request, reply) => {
    const { id } = request.params;
    const page = await fastify.prisma.cmsPage.update({
      where: { id },
      data: request.body,
    });
    return { success: true, data: { page } };
  });

  // 删除页面
  fastify.delete('/pages/:id', async (request, reply) => {
    const { id } = request.params;
    await fastify.prisma.cmsPage.delete({ where: { id } });
    return { success: true, message: 'Page deleted successfully' };
  });
}

module.exports = fp(cmsPlugin, {
  name: 'cms-plugin',
  fastify: '5.x',
});

