const {
  createGeneration,
  listGenerations,
  getGenerationById,
} = require('../services/generationService');

const create = async (req, res, next) => {
  try {
    const generation = await createGeneration(req.user.userId, req.body);

    return res.status(201).json({
      success: true,
      data: generation,
    });
  } catch (error) {
    return next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const { generations, meta } = await listGenerations(req.user.userId, req.query.limit);

    return res.status(200).json({
      success: true,
      data: generations,
      meta,
    });
  } catch (error) {
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const generation = await getGenerationById(req.user.userId, req.params.id);

    return res.status(200).json({
      success: true,
      data: generation,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  create,
  list,
  getById,
};
