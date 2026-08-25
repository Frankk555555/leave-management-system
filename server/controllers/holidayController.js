const { Holiday } = require("../models");
const { Op } = require("sequelize");

// @desc    Get all holidays
// @route   GET /api/holidays
// @access  Private
const getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    let where = {};

    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        where.date = {
          [Op.between]: [`${yearNum}-01-01`, `${yearNum}-12-31`],
        };
      }
    }

    const holidays = await Holiday.findAll({
      where,
      order: [["date", "ASC"]],
    });
    res.json(holidays);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Create holiday
// @route   POST /api/holidays
// @access  Private/Admin
const createHoliday = async (req, res) => {
  try {
    const { name, date, description, isHalfDay } = req.body;
    const yearNum = date ? parseInt(String(date).split("-")[0], 10) : new Date().getFullYear();

    const holiday = await Holiday.create({
      name,
      date,
      year: yearNum,
      description,
      isHalfDay: isHalfDay || false,
    });

    res.status(201).json(holiday);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update holiday
// @route   PUT /api/holidays/:id
// @access  Private/Admin
const updateHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByPk(req.params.id);

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    const { name, date, description, isHalfDay } = req.body;
    const updateData = {
      name: name || holiday.name,
      date: date || holiday.date,
      description:
        description !== undefined ? description : holiday.description,
      isHalfDay: isHalfDay !== undefined ? isHalfDay : holiday.isHalfDay,
    };

    if (date) {
      updateData.year = parseInt(String(date).split("-")[0], 10);
    }

    await holiday.update(updateData);

    res.json(holiday);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Delete holiday
// @route   DELETE /api/holidays/:id
// @access  Private/Admin
const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByPk(req.params.id);

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    await holiday.destroy();
    res.json({ message: "Holiday removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Initialize default holidays for year
// @route   POST /api/holidays/init
// @access  Private/Admin
const initializeHolidays = async (req, res) => {
  try {
    const targetYear =
      parseInt(req.body?.year || req.query?.year, 10) ||
      new Date().getFullYear();

    const defaultHolidays = [
      {
        name: "วันขึ้นปีใหม่",
        date: `${targetYear}-01-01`,
        description: "New Year's Day",
      },
      {
        name: "วันมาฆบูชา",
        date: `${targetYear}-02-24`,
        description: "Makha Bucha Day",
      },
      {
        name: "วันจักรี",
        date: `${targetYear}-04-06`,
        description: "Chakri Memorial Day",
      },
      {
        name: "วันสงกรานต์",
        date: `${targetYear}-04-13`,
        description: "Songkran Festival",
      },
      {
        name: "วันสงกรานต์",
        date: `${targetYear}-04-14`,
        description: "Songkran Festival",
      },
      {
        name: "วันสงกรานต์",
        date: `${targetYear}-04-15`,
        description: "Songkran Festival",
      },
      {
        name: "วันแรงงานแห่งชาติ",
        date: `${targetYear}-05-01`,
        description: "National Labour Day",
      },
      {
        name: "วันฉัตรมงคล",
        date: `${targetYear}-05-04`,
        description: "Coronation Day",
      },
      {
        name: "วันวิสาขบูชา",
        date: `${targetYear}-05-22`,
        description: "Visakha Bucha Day",
      },
      {
        name: "วันเฉลิมพระชนมพรรษา ร.10",
        date: `${targetYear}-07-28`,
        description: "H.M. King's Birthday",
      },
      {
        name: "วันเฉลิมพระชนมพรรษา พระราชินี",
        date: `${targetYear}-08-12`,
        description: "H.M. Queen's Birthday",
      },
      {
        name: "วันคล้ายวันสวรรคต ร.9",
        date: `${targetYear}-10-13`,
        description: "King Bhumibol Memorial Day",
      },
      {
        name: "วันปิยมหาราช",
        date: `${targetYear}-10-23`,
        description: "Chulalongkorn Day",
      },
      {
        name: "วันคล้ายวันพระบรมราชสมภพ ร.9",
        date: `${targetYear}-12-05`,
        description: "King Bhumibol's Birthday",
      },
      {
        name: "วันรัฐธรรมนูญ",
        date: `${targetYear}-12-10`,
        description: "Constitution Day",
      },
      {
        name: "วันสิ้นปี",
        date: `${targetYear}-12-31`,
        description: "New Year's Eve",
      },
    ];

    for (const holiday of defaultHolidays) {
      const exists = await Holiday.findOne({
        where: {
          date: holiday.date,
        },
      });

      if (!exists) {
        await Holiday.create({
          name: holiday.name,
          date: holiday.date,
          year: targetYear,
          description: holiday.description,
          isHalfDay: false,
        });
      }
    }

    const holidays = await Holiday.findAll({
      where: {
        date: {
          [Op.between]: [`${targetYear}-01-01`, `${targetYear}-12-31`],
        },
      },
      order: [["date", "ASC"]],
    });

    res.json(holidays);
  } catch (error) {
    console.error("Initialize holidays error:", error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  initializeHolidays,
};
